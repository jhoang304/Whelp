"""
Cover photo (`preview`) rules for restaurant images, per issue #23:

* only the restaurant's owner may mark a photo as the cover;
* a restaurant never has two `preview=True` rows, so `GET /api/restaurants`
  cannot pick a different cover depending on iteration order.
"""
from app.models import RestaurantImage
from tests.conftest import login


def previews(restaurant_id):
    return RestaurantImage.query.filter_by(restaurant_id=restaurant_id, preview=True).all()


def add_image(client, restaurant_id, url, preview=False):
    return client.post(f"/api/restaurants/{restaurant_id}/images",
                       json={"url": url, "preview": preview})


def test_add_photo_requires_login(client, ids):
    assert add_image(client, ids["restaurant"], "https://example.com/b.jpg").status_code in (302, 401)


def test_any_logged_in_user_can_add_a_plain_photo(client, ids):
    login(client, "bystander@test.io")
    res = add_image(client, ids["restaurant"], "https://example.com/b.jpg")
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["preview"] is False
    assert len(previews(ids["restaurant"])) == 1


def test_non_owner_cannot_set_the_cover_photo(client, ids):
    login(client, "bystander@test.io")
    res = add_image(client, ids["restaurant"], "https://example.com/hijack.jpg", preview=True)
    assert res.status_code == 403
    assert isinstance(res.get_json()["errors"], list)
    # the seeded cover is untouched and no row was created
    assert [image.url for image in previews(ids["restaurant"])] == ["https://example.com/a.jpg"]
    assert RestaurantImage.query.filter_by(url="https://example.com/hijack.jpg").first() is None


def test_owner_adding_a_cover_photo_demotes_the_previous_one(client, ids):
    login(client, "owner@test.io")
    res = add_image(client, ids["restaurant"], "https://example.com/new-cover.jpg", preview=True)
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["preview"] is True

    covers = previews(ids["restaurant"])
    assert len(covers) == 1
    assert covers[0].url == "https://example.com/new-cover.jpg"


def test_a_body_without_preview_adds_a_plain_photo(client, ids):
    """The route used to KeyError on a body that left `preview` out."""
    login(client, "owner@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/images",
                      json={"url": "https://example.com/c.jpg"})
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["preview"] is False


def test_owner_can_promote_an_existing_photo_to_cover(client, ids):
    login(client, "owner@test.io")
    added = add_image(client, ids["restaurant"], "https://example.com/b.jpg")
    new_id = added.get_json()["id"]

    res = client.put(f"/api/restaurant-images/{new_id}/cover")
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["preview"] is True

    covers = previews(ids["restaurant"])
    assert len(covers) == 1
    assert covers[0].id == new_id
    assert RestaurantImage.query.get(ids["image"]).preview is False


def test_setting_the_current_cover_again_is_a_no_op(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/restaurant-images/{ids['image']}/cover")
    assert res.status_code == 200, res.get_json()
    assert [image.id for image in previews(ids["restaurant"])] == [ids["image"]]


def test_only_the_owner_can_promote_a_photo(client, ids):
    login(client, "owner@test.io")
    new_id = add_image(client, ids["restaurant"], "https://example.com/b.jpg").get_json()["id"]
    client.get("/api/auth/logout")

    # the uploader of the seeded photo is not the owner and may not promote either
    login(client, "reviewer@test.io")
    res = client.put(f"/api/restaurant-images/{new_id}/cover")
    assert res.status_code == 403
    assert RestaurantImage.query.get(new_id).preview is False


def test_promoting_requires_login_and_an_existing_image(client, ids):
    assert client.put(f"/api/restaurant-images/{ids['image']}/cover").status_code in (302, 401)
    login(client, "owner@test.io")
    assert client.put("/api/restaurant-images/9999/cover").status_code == 404


def test_restaurant_list_reports_the_current_cover(client, ids):
    login(client, "owner@test.io")
    add_image(client, ids["restaurant"], "https://example.com/new-cover.jpg", preview=True)

    listing = client.get("/api/restaurants/").get_json()["Restaurants"]
    entry = next(r for r in listing if r["id"] == ids["restaurant"])
    assert entry["previewImage"] == "https://example.com/new-cover.jpg"


def test_deleting_the_cover_promotes_another_photo(client, ids):
    """A restaurant with photos left must never be without a cover."""
    login(client, "owner@test.io")
    second = add_image(client, ids["restaurant"], "https://example.com/b.jpg").get_json()["id"]
    third = add_image(client, ids["restaurant"], "https://example.com/c.jpg").get_json()["id"]

    # the seeded image is the cover; deleting it must hand the badge on
    assert client.delete(f"/api/restaurant-images/{ids['image']}").status_code == 200

    covers = previews(ids["restaurant"])
    assert len(covers) == 1
    assert covers[0].id == second, "the oldest remaining photo takes over"
    assert RestaurantImage.query.get(third).preview is False


def test_the_listing_keeps_a_cover_after_the_current_one_is_deleted(client, ids):
    login(client, "owner@test.io")
    add_image(client, ids["restaurant"], "https://example.com/b.jpg")
    client.delete(f"/api/restaurant-images/{ids['image']}")

    listing = client.get("/api/restaurants/").get_json()["Restaurants"]
    entry = next(r for r in listing if r["id"] == ids["restaurant"])
    assert entry["previewImage"] == "https://example.com/b.jpg"


def test_deleting_the_last_photo_leaves_no_cover(client, ids):
    """Nothing to promote is fine; the card falls back to the placeholder."""
    login(client, "owner@test.io")
    assert client.delete(f"/api/restaurant-images/{ids['image']}").status_code == 200
    assert previews(ids["restaurant"]) == []


def test_deleting_a_non_cover_photo_leaves_the_cover_alone(client, ids):
    login(client, "owner@test.io")
    second = add_image(client, ids["restaurant"], "https://example.com/b.jpg").get_json()["id"]

    assert client.delete(f"/api/restaurant-images/{second}").status_code == 200
    assert [image.id for image in previews(ids["restaurant"])] == [ids["image"]]
