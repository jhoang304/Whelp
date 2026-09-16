from app.models import Restaurant, db


def test_list_returns_every_restaurant(client, ids):
    res = client.get("/api/restaurants/")
    assert res.status_code == 200
    restaurants = res.get_json()["Restaurants"]
    assert [restaurant["id"] for restaurant in restaurants] == [ids["restaurant"]]


def test_list_entry_carries_the_card_fields(client, ids):
    """The restaurant cards read avgRating, previewImage and oneReview off the list."""
    res = client.get("/api/restaurants/")
    entry = res.get_json()["Restaurants"][0]
    assert entry["name"] == "Test Bistro"
    assert entry["user_id"] == ids["owner"]
    assert entry["avgRating"] == 4
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
    entry = next(restaurant for restaurant in res.get_json()["Restaurants"]
                 if restaurant["name"] == "No Reviews Diner")
    assert entry["avgRating"] == 0
    assert entry["previewImage"] is None
    assert entry["oneReview"] is None
