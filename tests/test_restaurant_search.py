import pytest

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


# --- every word, not one phrase (#118) -----------------------------------------------

from app.models import Category  # noqa: E402


def place(owner_id, name, city, state, categories=(), description="Good food."):
    restaurant = Restaurant(
        user_id=owner_id, name=name, price="$$", address="1 Any St", city=city, state=state,
        zipcode="10001", country="USA", phone_number="(555) 000-0000",
        website="http://example.com", description=description)
    for category_name in categories:
        category = Category.query.filter_by(name=category_name).first()
        if category is None:
            category = Category(name=category_name, slug=category_name.lower().replace(" ", "-"))
        restaurant.categories.append(category)
    db.session.add(restaurant)
    db.session.commit()
    return restaurant.id


@pytest.fixture()
def town(ids):
    """The seed data's shape: the fixtures' Test Bistro in Houston, TX, and these."""
    return {
        "bistro": ids["restaurant"],
        "au_cheval": place(ids["owner"], "Au Cheval", "Chicago", "IL", ["Burgers"]),
        "uchi": place(ids["owner"], "Uchi", "Houston", "TX", ["Sushi Bars", "Japanese"]),
        "joes": place(ids["owner"], "Joe's Pizza", "New York", "NY", ["Pizza"]),
        "frontier": place(ids["owner"], "Frontier", "Albuquerque", "NM", ["Breakfast & Brunch"]),
    }


def found(client, keyword):
    return sorted(restaurant["id"] for restaurant in search(client, keyword))


@pytest.mark.parametrize("keyword, expected", [
    ("burgers chicago", ["au_cheval"]),
    ("Uchi Houston", ["uchi"]),
    ("sushi houston", ["uchi"]),
    ("TX", ["bistro", "uchi"]),
    ("Texas", ["bistro", "uchi"]),
    ("tx", ["bistro", "uchi"]),
    ("sushi texas", ["uchi"]),
])
def test_the_searches_the_box_invites(client, town, keyword, expected):
    """Each of these found nothing: the whole query had to sit inside one field."""
    assert found(client, keyword) == sorted(town[name] for name in expected)


@pytest.mark.parametrize("keyword", ["%", "_", "a%", "%%", "_x_"])
def test_wildcards_are_just_characters(client, town, keyword):
    """'%' and '_' matched every restaurant: they went into the LIKE pattern as they were."""
    assert found(client, keyword) == []


def test_a_percent_or_underscore_in_a_name_is_found_as_itself(client, ids, town):
    beef = place(ids["owner"], "100% Beef", "Houston", "TX")
    snake = place(ids["owner"], "Snake_Case Cafe", "Houston", "TX")
    assert found(client, "100%") == [beef]
    assert found(client, "%") == [beef]
    assert found(client, "_") == [snake]
    assert found(client, "e_c") == [snake]  # a literal underscore, not "any one character"


def test_a_backslash_is_just_a_character_too(client, ids, town):
    assert found(client, "\\") == []
    assert found(client, "uchi\\") == []
    slash = place(ids["owner"], r"Back\slash Bar", "Houston", "TX")
    place(ids["owner"], "100% Beef", "Houston", "TX")
    # Left unescaped, the backslash escaped the pattern's closing % instead.
    assert found(client, "\\") == [slash]


def test_every_word_must_match_somewhere(client, town):
    assert found(client, "burgers houston") == []  # burgers are in Chicago
    assert found(client, "uchi chicago") == []


def test_words_that_only_join_a_query_are_left_out(client, town):
    assert found(client, "sushi in houston") == [town["uchi"]]
    assert found(client, "pizza near new york") == [town["joes"]]
    assert found(client, "burgers & chicago") == [town["au_cheval"]]


def test_a_state_of_several_words_is_one_term(client, town):
    assert found(client, "new mexico") == [town["frontier"]]
    assert found(client, "breakfast new mexico") == [town["frontier"]]
    # "New York" is a state and a city; either finds Joe's.
    assert found(client, "new york") == [town["joes"]]
    assert found(client, "ny") == [town["joes"]]


def test_a_short_word_that_is_not_a_state_still_looks_only_at_name_and_city(client, town):
    assert found(client, "au") == [town["au_cheval"]]
    assert found(client, "pl") == []  # only in the fixtures' description


def test_named_for_the_query_comes_before_serving_it(client, ids, town):
    named = place(ids["owner"], "Burger Barn", "Chicago", "IL")
    results = [restaurant["id"] for restaurant in search(client, "burger chicago")]
    assert results[0] == named
    assert set(results) == {named, town["au_cheval"]}


def test_named_for_all_of_it_comes_before_named_for_part(client, ids, town):
    # Made first, so a tie in relevance would put it first: ties go by id.
    # "le" is short, so it is looked for in the name and city only: Lebanon has it.
    partly = place(ids["owner"], "Cheval Blanc", "Lebanon", "TX")
    wholly = place(ids["owner"], "Le Cheval", "Dallas", "TX")
    results = [restaurant["id"] for restaurant in search(client, "le cheval")]
    assert results == [wholly, partly]


@pytest.mark.parametrize("keyword, terms", [
    ("burgers chicago", ["burgers", "chicago"]),
    ("  Sushi   in HOUSTON ", ["sushi", "houston"]),
    ("tacos new mexico", ["new mexico", "tacos"]),
    ("west virginia", ["west virginia"]),     # not "virginia" and a stray "west"
    ("in", ["in"]),                            # a query of nothing but fillers keeps them
    ("the new york", ["new york"]),
])
def test_how_a_query_is_read(keyword, terms):
    from app.api.search import search_terms
    assert search_terms(keyword) == terms


def test_every_state_name_maps_to_a_code_the_app_knows():
    from app.api.hours import STATE_TIMEZONES
    from app.api.search import STATE_CODES_BY_NAME
    assert set(STATE_CODES_BY_NAME.values()) == set(STATE_TIMEZONES)


def test_serving_it_comes_before_mentioning_it(client, ids, town):
    # Made first, so a tie in relevance would put it first: ties go by id.
    mentions = place(ids["owner"], "Corner Diner", "Austin", "TX", description="Tacos on Tuesdays.")
    serves = place(ids["owner"], "La Cocina", "Austin", "TX", ["Tacos"])
    results = [restaurant["id"] for restaurant in search(client, "tacos")]
    assert results == [serves, mentions]
