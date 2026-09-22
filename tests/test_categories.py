"""
What a restaurant serves.

The taxonomy is closed: a restaurant picks from it rather than typing its own,
so a filter for one cuisine finds every restaurant in it instead of splitting
them across "BBQ", "Bbq" and "barbeque".
"""
from app.api.categories import MAX_CATEGORIES
from app.models import Category, Restaurant, db, restaurant_categories
from tests.conftest import login


def add_categories(*pairs):
    """{name: id} for the given (name, slug) pairs."""
    made = [Category(name=name, slug=slug) for name, slug in pairs]
    db.session.add_all(made)
    db.session.commit()
    return {category.name: category.id for category in made}


def payload(**overrides):
    body = {
        "name": "New Bistro",
        "price": "$$",
        "address": "9 New St",
        "city": "Austin",
        "state": "TX",
        "zipcode": "78701",
        "country": "USA",
        "phone_number": "(555) 999-0000",
        "website": "http://new.com",
        "description": "Brand new.",
    }
    body.update(overrides)
    return body


def give(restaurant_id, *category_ids):
    restaurant = db.session.get(Restaurant, restaurant_id)
    restaurant.categories = Category.query.filter(Category.id.in_(category_ids)).all()
    db.session.commit()


def test_the_taxonomy_is_served_by_name(client):
    add_categories(("Wine Bars", "wine-bars"), ("Japanese", "japanese"))

    res = client.get("/api/categories/")

    assert res.status_code == 200
    items = res.get_json()["items"]
    assert [item["name"] for item in items] == ["Japanese", "Wine Bars"]
    assert items[0]["slug"] == "japanese"


def test_a_card_carries_the_restaurants_categories(client, ids):
    made = add_categories(("Japanese", "japanese"), ("Sushi Bars", "sushi-bars"))
    give(ids["restaurant"], made["Japanese"], made["Sushi Bars"])

    card = client.get("/api/restaurants/").get_json()["items"][0]

    assert [category["name"] for category in card["categories"]] == ["Japanese", "Sushi Bars"]


def test_a_restaurant_with_no_categories_says_so_with_a_list(client, ids):
    """Not a missing key: the chips render off this, and undefined is not empty."""
    card = client.get("/api/restaurants/").get_json()["items"][0]
    assert card["categories"] == []


def test_the_detail_page_carries_them_too(client, ids):
    made = add_categories(("Cuban", "cuban"),)
    give(ids["restaurant"], made["Cuban"])

    body = client.get(f"/api/restaurants/{ids['restaurant']}").get_json()

    assert body["categories"] == [{"id": made["Cuban"], "name": "Cuban", "slug": "cuban"}]


def test_creating_a_restaurant_sets_its_categories(client, ids):
    made = add_categories(("Pizza", "pizza"), ("Italian", "italian"))
    login(client, "owner@test.io")

    res = client.post("/api/restaurants/",
                      json=payload(category_ids=[made["Pizza"], made["Italian"]]))

    assert res.status_code == 200, res.get_json()
    assert sorted(category["name"] for category in res.get_json()["categories"]) == ["Italian", "Pizza"]
    created = Restaurant.query.filter_by(name="New Bistro").one()
    assert {category.name for category in created.categories} == {"Italian", "Pizza"}


def test_a_category_that_does_not_exist_writes_no_restaurant(client, ids):
    login(client, "owner@test.io")
    before = Restaurant.query.count()

    res = client.post("/api/restaurants/", json=payload(category_ids=[9999]))

    assert res.status_code == 400
    assert res.get_json()["errors"] == ["Each category must be chosen from the list."]
    assert Restaurant.query.count() == before, "the restaurant must not have been created"


def test_more_than_the_limit_is_refused(client, ids):
    made = add_categories(("Pizza", "pizza"), ("Italian", "italian"),
                          ("Vegan", "vegan"), ("Desserts", "desserts"))
    assert len(made) > MAX_CATEGORIES
    login(client, "owner@test.io")

    res = client.post("/api/restaurants/", json=payload(category_ids=list(made.values())))

    assert res.status_code == 400
    assert str(MAX_CATEGORIES) in res.get_json()["errors"][0]


def test_the_same_category_twice_counts_once(client, ids):
    made = add_categories(("Pizza", "pizza"),)
    login(client, "owner@test.io")

    res = client.post("/api/restaurants/",
                      json=payload(category_ids=[made["Pizza"], made["Pizza"]]))

    assert res.status_code == 200, res.get_json()
    assert len(res.get_json()["categories"]) == 1


def test_something_that_is_not_an_id_is_refused(client, ids):
    login(client, "owner@test.io")
    for value in ([True], ["not-an-id"], [{"id": 1}], "pizza"):
        res = client.post("/api/restaurants/", json=payload(category_ids=value))
        assert res.status_code == 400, value
        assert Restaurant.query.filter_by(name="New Bistro").first() is None, value


def test_an_edit_that_never_mentions_categories_keeps_them(client, ids):
    """
    Every client written before this feature sends exactly that body, and an
    edit from one must not quietly strip a restaurant's cuisines.
    """
    made = add_categories(("Seafood", "seafood"),)
    give(ids["restaurant"], made["Seafood"])
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(name="Renamed"))

    assert res.status_code == 200, res.get_json()
    assert [category["name"] for category in res.get_json()["categories"]] == ["Seafood"]


def test_an_edit_with_an_empty_list_clears_them(client, ids):
    made = add_categories(("Seafood", "seafood"),)
    give(ids["restaurant"], made["Seafood"])
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(category_ids=[]))

    assert res.status_code == 200, res.get_json()
    assert res.get_json()["categories"] == []
    assert db.session.get(Restaurant, ids["restaurant"]).categories == []


def test_an_edit_replaces_rather_than_adds(client, ids):
    made = add_categories(("Seafood", "seafood"), ("Burgers", "burgers"))
    give(ids["restaurant"], made["Seafood"])
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}",
                     json=payload(category_ids=[made["Burgers"]]))

    assert res.status_code == 200, res.get_json()
    assert [category["name"] for category in res.get_json()["categories"]] == ["Burgers"]


def test_a_rejected_category_leaves_the_edit_unwritten(client, ids):
    made = add_categories(("Seafood", "seafood"),)
    give(ids["restaurant"], made["Seafood"])
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}",
                     json=payload(name="Renamed", category_ids=[9999]))

    assert res.status_code == 400
    restaurant = db.session.get(Restaurant, ids["restaurant"])
    assert restaurant.name == "Test Bistro", "the name must not have been written either"
    assert [category.name for category in restaurant.categories] == ["Seafood"]


def test_deleting_a_restaurant_takes_its_category_rows_with_it(client, ids):
    made = add_categories(("Seafood", "seafood"),)
    give(ids["restaurant"], made["Seafood"])
    login(client, "owner@test.io")

    res = client.delete(f"/api/restaurants/{ids['restaurant']}")

    assert res.status_code == 200
    assert db.session.query(restaurant_categories).count() == 0
    assert Category.query.count() == 1, "the category itself outlives the restaurant"
