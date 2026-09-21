"""
At most one cover photo per restaurant, enforced by the database.

It used to hold only while every write went through clear_other_previews. A
seeder, a shell, a new route or two racing requests could leave two covers,
and the listing would then show whichever row iterated last -- a restaurant's
cover changing between requests for no reason a user could see.
"""
import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Restaurant, RestaurantImage, db
from tests.conftest import login


def cover(restaurant_id, url, user_id):
    return RestaurantImage(restaurant_id=restaurant_id, url=url, preview=True,
                           createdByUserId=user_id)


def test_a_second_cover_is_refused_by_the_database(ids):
    """The fixture's restaurant already has one."""
    db.session.add(cover(ids["restaurant"], "https://example.com/second.jpg", ids["owner"]))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_each_restaurant_may_have_its_own_cover(ids):
    other = Restaurant(
        user_id=ids["owner"], name="Second Bistro", price="$", address="9 Side St",
        city="Austin", state="TX", zipcode="78701", country="USA",
        phone_number="(555) 222-3333", website="http://second.com", description="Another.")
    db.session.add(other)
    db.session.commit()

    db.session.add(cover(other.id, "https://example.com/theirs.jpg", ids["owner"]))
    db.session.commit()  # the constraint is per restaurant, not global

    assert RestaurantImage.query.filter_by(preview=True).count() == 2


def test_a_restaurant_may_have_many_photos_that_are_not_covers(ids):
    """The index is partial: only preview rows are unique per restaurant."""
    db.session.add_all([
        RestaurantImage(restaurant_id=ids["restaurant"], url=f"https://example.com/{n}.jpg",
                        preview=False, createdByUserId=ids["owner"])
        for n in range(4)
    ])
    db.session.commit()
    assert RestaurantImage.query.filter_by(restaurant_id=ids["restaurant"]).count() == 5


def test_promoting_a_photo_still_works_through_the_route(client, ids):
    """
    The app demotes the old cover before promoting the new one. If it did that
    in the other order the constraint would reject a legitimate change, so
    this is the test that would catch it.
    """
    login(client, "owner@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/images",
                      json={"url": "https://example.com/new.jpg", "preview": True})
    assert res.status_code == 200, res.get_json()

    covers = RestaurantImage.query.filter_by(restaurant_id=ids["restaurant"], preview=True).all()
    assert [image.url for image in covers] == ["https://example.com/new.jpg"]


def test_the_listing_reports_that_one_cover(client, ids):
    login(client, "owner@test.io")
    client.post(f"/api/restaurants/{ids['restaurant']}/images",
                json={"url": "https://example.com/new.jpg", "preview": True})

    card = client.get("/api/restaurants/").get_json()["Restaurants"][0]
    assert card["previewImage"] == "https://example.com/new.jpg"
