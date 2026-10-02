from app.api.utils import CARD_EXCERPT_LENGTH, excerpt
from app.models import Restaurant, Review, db


def test_list_returns_every_restaurant(client, ids):
    res = client.get("/api/restaurants/")
    assert res.status_code == 200
    restaurants = res.get_json()["items"]
    assert [restaurant["id"] for restaurant in restaurants] == [ids["restaurant"]]


def test_list_entry_carries_the_card_fields(client, ids):
    """The restaurant cards read avgRating, previewImage and oneReview off the list."""
    res = client.get("/api/restaurants/")
    entry = res.get_json()["items"][0]
    assert entry["name"] == "Test Bistro"
    assert entry["user_id"] == ids["owner"]
    assert entry["avgRating"] == 4
    assert entry["numReviews"] == 1
    assert entry["previewImage"] == "https://example.com/a.jpg"
    assert entry["oneReview"] == "Solid."


def test_a_restaurant_with_no_reviews_or_photos_is_still_listed(client, ids):
    db.session.add(Restaurant(
        user_id=ids["owner"], name="No Reviews Diner", price="$", address="3 Back St",
        city="Dallas", state="TX", zipcode="75201", country="USA",
        phone_number="(555) 222-3333", website="http://noreviews.com",
        description="Nobody has been yet."))
    db.session.commit()

    res = client.get("/api/restaurants/")
    entry = next(restaurant for restaurant in res.get_json()["items"]
                 if restaurant["name"] == "No Reviews Diner")
    assert entry["avgRating"] == 0
    assert entry["previewImage"] is None
    assert entry["oneReview"] is None


# --- the card's line of the newest review (#133) -------------------------------------

def test_a_long_newest_review_is_cut_to_a_line_on_the_card(client, ids):
    """Reviews may run to 5,000 characters; a card shows the start of one."""
    review = db.session.get(Review, ids["review"])
    review.review = "Every course was better than the last. " * 100
    db.session.commit()

    card = client.get("/api/restaurants/").get_json()["items"][0]
    assert card["oneReview"].startswith("Every course was better than the last. Every")
    assert card["oneReview"].endswith("\u2026")
    assert len(card["oneReview"]) <= CARD_EXCERPT_LENGTH + 1
    # The review itself is untouched.
    assert len(db.session.get(Review, ids["review"]).review) == 3900


def test_a_short_review_is_left_alone():
    assert excerpt("Solid.") == "Solid."
    assert excerpt(None) is None


def test_an_excerpt_ends_after_a_whole_word():
    text = "word " * 100
    cut = excerpt(text, limit=23)
    assert cut == "word word word word\u2026"


def test_an_excerpt_is_one_line():
    assert excerpt("Great.\n\nWould go back.") == "Great. Would go back."


def test_one_enormous_word_is_cut_where_it_is():
    assert excerpt("x" * 50, limit=20) == "x" * 20 + "\u2026"
