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
    assert res.get_json()["Restaurants"] == []


def test_search_results_carry_ratings_and_preview(client):
    result = search(client, "bistro")[0]
    assert result["avgRating"] == 4
    assert result["numReviews"] == 1
    assert result["previewImage"] == "https://example.com/a.jpg"
    assert result["oneReview"] == "Solid."
