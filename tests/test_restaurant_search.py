from app.models import Restaurant, db


def search(client, keyword):
    # The query string, as the app sends it: `query_string` encodes the value
    # once, the way URLSearchParams does in the browser.
    res = client.get("/api/restaurants/search", query_string={"q": keyword})
    assert res.status_code == 200, res.get_json()
    return res.get_json()["items"]


def add_restaurant(owner_id, name):
    restaurant = Restaurant(
        user_id=owner_id, name=name, price="$", address="2 Side St", city="Austin", state="TX",
        zipcode="78701", country="USA", phone_number="(555) 000-0000",
        website="http://extra.com", description="Somewhere else.")
    db.session.add(restaurant)
    db.session.commit()
    return restaurant.id


def test_search_matches_a_name(client, ids):
    results = search(client, "bistro")
    assert [restaurant["id"] for restaurant in results] == [ids["restaurant"]]


def test_search_ignores_case(client, ids):
    assert [restaurant["id"] for restaurant in search(client, "BISTRO")] == [ids["restaurant"]]


def test_search_matches_a_city_or_description(client, ids):
    assert [restaurant["id"] for restaurant in search(client, "houston")] == [ids["restaurant"]]
    assert [restaurant["id"] for restaurant in search(client, "tests")] == [ids["restaurant"]]


def test_a_restaurant_matching_twice_is_returned_once(client, ids):
    """'test' hits both the name and the description; the two queries must not double up."""
    assert [restaurant["id"] for restaurant in search(client, "test")] == [ids["restaurant"]]


def test_short_keywords_only_look_at_name_and_city(client, ids):
    """Under three characters the search skips description and state, or everything matches."""
    assert [restaurant["id"] for restaurant in search(client, "te")] == [ids["restaurant"]]
    assert [restaurant["id"] for restaurant in search(client, "ho")] == [ids["restaurant"]]
    assert search(client, "pl") == []  # only in the description


def test_search_with_no_matches_is_an_empty_list(client):
    assert search(client, "nowhere-near-a-match") == []


def test_a_blank_keyword_is_rejected(client):
    for query in ({"q": " "}, {"q": ""}, {}):
        res = client.get("/api/restaurants/search", query_string=query)
        assert res.status_code == 400, query
        assert res.get_json()["errors"] == ["Search keyword cannot be empty"]


def test_a_keyword_can_hold_a_slash(client, ids):
    """In the path, the server decoded %2F before routing and answered 404 (#108)."""
    diner = add_restaurant(ids["owner"], "24/7 Diner")
    assert [restaurant["id"] for restaurant in search(client, "24/7")] == [diner]


def test_a_keyword_can_hold_an_ampersand_or_a_plus(client, ids):
    grill = add_restaurant(ids["owner"], "Bar & Grill")
    plus = add_restaurant(ids["owner"], "C++ Cafe")
    assert [restaurant["id"] for restaurant in search(client, "bar & grill")] == [grill]
    assert [restaurant["id"] for restaurant in search(client, "c++")] == [plus]


def test_the_keyword_in_the_path_still_answers(client, ids):
    """For a tab still running the previous bundle while a deploy lands."""
    res = client.get("/api/restaurants/search/bistro")
    assert res.status_code == 200
    assert [restaurant["id"] for restaurant in res.get_json()["items"]] == [ids["restaurant"]]
    assert client.get("/api/restaurants/search/%20").status_code == 400


def test_search_results_carry_ratings_and_preview(client):
    result = search(client, "bistro")[0]
    assert result["avgRating"] == 4
    assert result["numReviews"] == 1
    assert result["previewImage"] == "https://example.com/a.jpg"
    assert result["oneReview"] == "Solid."


def test_the_teaser_is_the_review_the_feed_puts_first(client, ids):
    """
    Both cards show one review's text, and they used to disagree about which:
    the listing kept the newest, search the oldest.

    Newest means createdAt, not the highest id. This review is written last
    but dated two years ago, which is the shape the seeds produce -- ranking
    on id would show it while the feed showed the other one.
    """
    from datetime import datetime

    from app.models import Review, User, db

    latecomer = User(username="latecomer", email="latecomer@test.io", password="password",
                     first_name="Late", last_name="Comer")
    db.session.add(latecomer)
    db.session.commit()
    backdated = Review(user_id=latecomer.id, restaurant_id=ids["restaurant"],
                       review="Was here two years ago.", rating=2)
    backdated.createdAt = datetime(2023, 1, 1)
    db.session.add(backdated)
    db.session.commit()

    feed = client.get(f"/api/restaurants/{ids['restaurant']}/reviews").get_json()["items"]
    listed = client.get("/api/restaurants/").get_json()["items"][0]
    searched = search(client, "bistro")[0]

    assert listed["oneReview"] == searched["oneReview"] == feed[0]["review"] == "Solid."
    assert listed["numReviews"] == searched["numReviews"] == 2
