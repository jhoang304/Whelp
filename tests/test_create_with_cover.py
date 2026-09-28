"""
A restaurant and its cover photo are created together, or not at all (#114).

The cover used to be a second request, sent after the restaurant had been
committed. When it failed -- a pasted link longer than the column, say --
the restaurant was already there, the form stayed open, and every retry
made another one. Now POST /api/restaurants/ takes the cover as `url` and
writes both in one commit.
"""
import pytest

from app.models import Restaurant, RestaurantImage
from tests.conftest import login
from tests.test_form_lengths import restaurant_payload
from tests.test_images import BUCKET_URL, configure_s3

COVER = "https://example.com/cover.jpg"


def created(res):
    assert res.status_code == 200, res.get_json()
    return Restaurant.query.filter_by(id=res.get_json()["id"]).one()


def test_the_cover_is_created_with_the_restaurant(client, ids):
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=restaurant_payload(url=COVER))

    restaurant = created(res)
    [cover] = restaurant.restaurant_images
    assert cover.url == COVER
    assert cover.preview is True
    assert cover.createdByUserId == ids["owner"]
    assert cover.s3_key is None  # a link, not one of our uploads
    assert res.get_json()["previewImage"] == COVER


def test_the_restaurant_page_shows_it_as_the_cover(client):
    login(client, "owner@test.io")
    restaurant_id = client.post("/api/restaurants/", json=restaurant_payload(url=COVER)).get_json()["id"]

    images = client.get(f"/api/restaurants/{restaurant_id}").get_json()["restaurantImages"]
    assert [(image["url"], image["preview"]) for image in images] == [(COVER, True)]


def test_an_upload_of_the_callers_own_is_recorded_as_theirs(client, ids, monkeypatch):
    """So deleting the restaurant can delete the object, as with any photo."""
    configure_s3(monkeypatch)
    mine = f"{BUCKET_URL}uploads/{ids['owner']}/cover.png"
    login(client, "owner@test.io")

    restaurant = created(client.post("/api/restaurants/", json=restaurant_payload(url=mine)))

    assert restaurant.restaurant_images[0].s3_key == f"uploads/{ids['owner']}/cover.png"


@pytest.mark.parametrize("url, message", [
    ("https://cdn.example.com/" + "a" * 300 + ".jpg", "Image URL must be 255 characters or fewer."),
    ("ftp://example.com/cover.jpg", "Image URL must start with http:// or https://."),
    ("   ", "Image URL is required."),
    (5, "url must be text."),
])
def test_a_cover_that_is_refused_creates_nothing(client, url, message):
    login(client, "owner@test.io")
    restaurants_before = Restaurant.query.count()
    images_before = RestaurantImage.query.count()

    res = client.post("/api/restaurants/", json=restaurant_payload(url=url))

    assert res.status_code == 400
    assert message in res.get_json()["errors"]
    assert Restaurant.query.count() == restaurants_before
    assert RestaurantImage.query.count() == images_before


def test_retrying_after_a_refused_cover_makes_one_restaurant(client):
    """The issue's case: fix the link, submit again, and there is one restaurant, not two."""
    login(client, "owner@test.io")
    too_long = "https://cdn.example.com/" + "a" * 300 + ".jpg"

    assert client.post("/api/restaurants/", json=restaurant_payload(url=too_long)).status_code == 400
    assert client.post("/api/restaurants/", json=restaurant_payload(url=COVER)).status_code == 200

    assert Restaurant.query.filter_by(name="Length Test").count() == 1


def test_a_restaurant_may_still_be_created_without_one(client):
    """The API has never required a cover; the form asks for one itself."""
    login(client, "owner@test.io")
    restaurant = created(client.post("/api/restaurants/", json=restaurant_payload()))
    assert restaurant.restaurant_images == []
