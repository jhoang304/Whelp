"""
Saving restaurants: the toggle, the list, and the flag on every card.

A save is a private bookmark. Only its owner can read the list, and the
`isFavorited` flag on a card answers for whoever is reading -- two people
looking at the same page see their own hearts.
"""
from app.models import Favorite, Restaurant, User, db
from tests.conftest import login
from tests.test_query_counts import add_restaurants, counted


def save(client, restaurant_id):
    return client.post(f"/api/restaurants/{restaurant_id}/favorite")


def unsave(client, restaurant_id):
    return client.delete(f"/api/restaurants/{restaurant_id}/favorite")


def saved_list(client, user_id, query=""):
    return client.get(f"/api/users/{user_id}/favorites{query}")


# --- the toggle ------------------------------------------------------------

def test_saving_a_restaurant_records_it_once(client, ids):
    login(client, "bystander@test.io")

    first = save(client, ids["restaurant"])
    again = save(client, ids["restaurant"])

    assert first.status_code == 201
    assert first.get_json() == {"isFavorited": True}
    # A double click is one bookmark, and not an error.
    assert again.status_code == 200
    assert again.get_json() == {"isFavorited": True}
    assert Favorite.query.filter_by(user_id=ids["bystander"]).count() == 1


def test_unsaving_takes_it_off_and_is_safe_to_repeat(client, ids):
    login(client, "bystander@test.io")
    save(client, ids["restaurant"])

    first = unsave(client, ids["restaurant"])
    again = unsave(client, ids["restaurant"])

    assert first.status_code == again.status_code == 200
    assert first.get_json() == again.get_json() == {"isFavorited": False}
    assert Favorite.query.count() == 0


def test_saving_needs_someone_logged_in(client, ids):
    # login_required answers by redirecting to /api/auth/unauthorized (a 401).
    assert save(client, ids["restaurant"]).status_code in (302, 401)
    assert unsave(client, ids["restaurant"]).status_code in (302, 401)
    assert Favorite.query.count() == 0


def test_a_restaurant_that_does_not_exist_cannot_be_saved(client, ids):
    login(client, "bystander@test.io")

    res = save(client, 9999)

    assert res.status_code == 404
    assert res.get_json() == {"errors": ["Restaurant couldn't be found"]}
    assert Favorite.query.count() == 0


def test_one_persons_unsave_does_not_touch_anyone_elses(client, ids):
    login(client, "bystander@test.io")
    save(client, ids["restaurant"])
    client.get("/api/auth/logout")
    login(client, "reviewer@test.io")
    save(client, ids["restaurant"])

    unsave(client, ids["restaurant"])

    remaining = Favorite.query.all()
    assert [favorite.user_id for favorite in remaining] == [ids["bystander"]]


# --- the flag on payloads -----------------------------------------------------

def test_cards_and_the_detail_page_say_whether_the_reader_saved_it(client, ids):
    login(client, "bystander@test.io")
    assert client.get("/api/restaurants/").get_json()["items"][0]["isFavorited"] is False

    save(client, ids["restaurant"])

    assert client.get("/api/restaurants/").get_json()["items"][0]["isFavorited"] is True
    assert client.get("/api/restaurants/search/bistro").get_json()["items"][0]["isFavorited"] is True
    assert client.get(f"/api/restaurants/{ids['restaurant']}").get_json()["isFavorited"] is True


def test_the_flag_is_the_readers_own(client, ids):
    login(client, "bystander@test.io")
    save(client, ids["restaurant"])
    client.get("/api/auth/logout")

    # Someone else, and nobody at all, see it unsaved.
    assert client.get(f"/api/restaurants/{ids['restaurant']}").get_json()["isFavorited"] is False
    login(client, "reviewer@test.io")
    assert client.get(f"/api/restaurants/{ids['restaurant']}").get_json()["isFavorited"] is False
    assert client.get("/api/restaurants/").get_json()["items"][0]["isFavorited"] is False


def test_the_flag_costs_one_query_however_many_cards(client, ids):
    login(client, "bystander@test.io")
    with counted() as small:
        client.get("/api/restaurants/")

    add_restaurants(ids["owner"], ids["reviewer"], 5)
    for restaurant in Restaurant.query.all():
        db.session.add(Favorite(user_id=ids["bystander"], restaurant_id=restaurant.id))
    db.session.commit()

    with counted() as large:
        client.get("/api/restaurants/")

    assert len(large) == len(small)


# --- the list --------------------------------------------------------------

def test_the_list_is_newest_save_first_as_cards(client, ids):
    add_restaurants(ids["owner"], ids["reviewer"], 2)
    first, second, third = [r.id for r in Restaurant.query.order_by(Restaurant.id).all()]
    login(client, "bystander@test.io")
    for restaurant_id in (second, first, third):
        save(client, restaurant_id)

    res = saved_list(client, ids["bystander"])

    assert res.status_code == 200
    body = res.get_json()
    assert [card["id"] for card in body["items"]] == [third, first, second]
    assert body["total"] == 3
    # The same cards the listing shows, so the page can draw them the same way.
    assert {"avgRating", "previewImage", "categories", "isFavorited"} <= set(body["items"][0])
    assert all(card["isFavorited"] for card in body["items"])


def test_the_list_pages(client, ids):
    add_restaurants(ids["owner"], ids["reviewer"], 4)
    login(client, "bystander@test.io")
    for restaurant in Restaurant.query.all():
        save(client, restaurant.id)

    page_two = saved_list(client, ids["bystander"], "?per_page=2&page=2").get_json()

    assert page_two["total"] == 5
    assert len(page_two["items"]) == 2
    assert page_two["page"] == 2


def test_nobody_else_can_read_it(client, ids):
    login(client, "bystander@test.io")
    save(client, ids["restaurant"])
    client.get("/api/auth/logout")
    login(client, "reviewer@test.io")

    res = saved_list(client, ids["bystander"])

    assert res.status_code == 403
    assert res.get_json() == {"errors": ["You can only see your own saved restaurants"]}


def test_nor_can_someone_logged_out(client, ids):
    assert saved_list(client, ids["bystander"]).status_code in (302, 401)


def test_only_the_owner_is_told_how_many_there_are(client, ids):
    login(client, "bystander@test.io")
    save(client, ids["restaurant"])

    own = client.get(f"/api/users/get/{ids['bystander']}").get_json()
    assert own["favorite_count"] == 1

    client.get("/api/auth/logout")
    assert "favorite_count" not in client.get(f"/api/users/get/{ids['bystander']}").get_json()


# --- when either side goes -------------------------------------------------

def test_deleting_a_restaurant_takes_it_off_every_list(client, ids):
    login(client, "bystander@test.io")
    save(client, ids["restaurant"])
    client.get("/api/auth/logout")
    login(client, "owner@test.io")

    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code == 200

    assert Favorite.query.count() == 0


def test_a_users_saves_go_with_them(app, ids):
    db.session.add(Favorite(user_id=ids["bystander"], restaurant_id=ids["restaurant"]))
    db.session.commit()

    db.session.delete(db.session.get(User, ids["bystander"]))
    db.session.commit()

    assert Favorite.query.count() == 0
