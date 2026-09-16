def search(client, keyword):
    res = client.get(f"/api/restaurants/search/{keyword}")
    assert res.status_code == 200, res.get_json()
    return res.get_json()["Restaurants"]


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
    res = client.get("/api/restaurants/search/%20")
    assert res.status_code == 400
    assert res.get_json()["errors"] == ["Search keyword cannot be empty"]


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

    feed = client.get(f"/api/restaurants/{ids['restaurant']}/reviews").get_json()["reviews"]
    listed = client.get("/api/restaurants/").get_json()["Restaurants"][0]
    searched = search(client, "bistro")[0]

    assert listed["oneReview"] == searched["oneReview"] == feed[0]["review"] == "Solid."
    assert listed["numReviews"] == searched["numReviews"] == 2
