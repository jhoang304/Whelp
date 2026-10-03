"""
The shared demo account (#136): what the API won't let it do, and the reset
that puts back what it may.

Everyone who clicks "Log in as Demo User" shares it, and every later visitor
saw what the last one left: the live Nancy's Hustle had been given Chinese,
Indian and Italian cuisines and daytime hours, and nothing stopped the demo
deleting its restaurants along with the reviews other people left there.
"""
import datetime

import pytest

from app.api import demo as refusals
from app.api.hours import parse_time
from app.models import Category, Restaurant, RestaurantHours, RestaurantImage, User, db
from app.seeds.demo_reset import demo_reset
from app.seeds.restaurant_images import PHOTOS
from app.seeds.users import DEMO_PROFILE
from tests.conftest import login

NANCY = "Nancy's Hustle"
BACARI = "Bacari Silverlake"


@pytest.fixture()
def demo(app):
    """The demo account, with its seeded restaurants made by the reset itself."""
    user = User(email="demo@aa.io", password="password", **DEMO_PROFILE)
    db.session.add(user)
    db.session.commit()
    changes, notes = demo_reset()
    assert [what for what, _ in changes] == [NANCY, BACARI]
    return user.id


def restaurant(name, owner_id=None):
    query = Restaurant.query.filter_by(name=name)
    if owner_id is not None:
        query = query.filter_by(user_id=owner_id)
    return query.one()


def body_for(row, **overrides):
    body = {field: getattr(row, field) for field in (
        "name", "price", "address", "city", "state", "zipcode", "country", "phone_number", "website", "description")}
    body.update(overrides)
    return body


# --- the reset ----------------------------------------------------------------------------

def test_a_missing_demo_restaurant_is_made_again_as_seeded(app, demo):
    nancy = restaurant(NANCY, demo)
    assert nancy.price == "$$$" and nancy.city == "Houston" and nancy.timezone == "America/Chicago"
    assert sorted(c.slug for c in nancy.categories) == ["cocktail-bars", "new-american", "wine-bars"]
    assert sorted(a.slug for a in nancy.amenities) == ["credit-cards", "groups", "outdoor-seating", "reservations"]
    assert len(nancy.hours) > 0
    assert sorted(image.url for image in nancy.restaurant_images) == sorted(PHOTOS[1])
    assert [image.url for image in nancy.restaurant_images if image.preview] == [PHOTOS[1][0]]
    assert sorted(image.url for image in restaurant(BACARI, demo).restaurant_images) == sorted(PHOTOS[4])


def test_a_second_run_finds_nothing_to_do(app, demo):
    assert demo_reset() == ([], [])


def test_what_a_visitor_changed_is_put_back(app, demo):
    nancy = restaurant(NANCY, demo)
    # As on the live site: other cuisines, daytime hours every day.
    nancy.categories = Category.query.filter(Category.slug.in_(["chinese", "indian", "italian"])).all()
    nancy.hours = []
    db.session.flush()
    nancy.hours = [RestaurantHours(weekday=day, opens=parse_time("08:00"), closes=parse_time("17:00")) for day in range(7)]
    nancy.price = "$"
    nancy.description = "Something else entirely."
    nancy.amenities = []
    # A cover of the demo's own, and a seeded photo gone.
    for image in nancy.restaurant_images:
        image.preview = False
    db.session.add(RestaurantImage(restaurant_id=nancy.id, url="https://example.com/mine.jpg", preview=True,
                                   createdByUserId=demo))
    db.session.delete(RestaurantImage.query.filter_by(restaurant_id=nancy.id, url=PHOTOS[1][3]).one())
    profile = db.session.get(User, demo)
    profile.first_name = "Defaced"
    profile.profile_image_url = "https://example.com/rude.png"
    # And a restaurant the demo made for itself.
    db.session.add(Restaurant(user_id=demo, name="Demo's Own Diner", price="$", address="1 Way", city="Austin",
                              state="TX", zipcode="78701", country="USA", phone_number="", website="",
                              description="Made by a visitor."))
    db.session.commit()

    changes, notes = demo_reset()

    assert dict(changes) == {
        "The demo's profile": ["first_name", "profile_image_url"],
        NANCY: ["price, description", "cuisines", "amenities", "hours", "1 photo", "cover"],
    }
    assert notes == []
    nancy = restaurant(NANCY, demo)
    assert nancy.price == "$$$"
    assert sorted(c.slug for c in nancy.categories) == ["cocktail-bars", "new-american", "wine-bars"]
    assert not any(row.opens == parse_time("08:00") for row in nancy.hours)
    assert [image.url for image in nancy.restaurant_images if image.preview] == [PHOTOS[1][0]]
    assert PHOTOS[1][3] in {image.url for image in nancy.restaurant_images}
    # It removes nothing: the demo's own photo and restaurant stay.
    assert "https://example.com/mine.jpg" in {image.url for image in nancy.restaurant_images}
    assert Restaurant.query.filter_by(name="Demo's Own Diner").count() == 1
    profile = db.session.get(User, demo)
    assert profile.first_name == "Demo" and profile.profile_image_url == DEMO_PROFILE["profile_image_url"]
    assert demo_reset() == ([], [])


def test_a_dry_run_says_what_it_would_do_and_does_nothing(app, demo):
    nancy = restaurant(NANCY, demo)
    nancy.price = "$"
    db.session.commit()

    changes, _ = demo_reset(apply=False)

    assert changes == [(NANCY, ["price"])]
    assert restaurant(NANCY, demo).price == "$"


def test_without_a_demo_account_there_is_nothing_to_reset(app):
    assert demo_reset() == ([], ["There is no demo account in this database."])


def test_a_username_someone_else_has_taken_is_left_alone(app, ids, demo):
    profile = db.session.get(User, demo)
    profile.username = "DemoRenamed"
    db.session.get(User, ids["bystander"]).username = "demo"
    db.session.commit()

    changes, notes = demo_reset()

    assert changes == []
    assert notes == ["Someone else now has the username 'Demo', so the demo keeps 'DemoRenamed'."]


def test_the_command_reports_what_it_put_back(app, demo):
    nancy = restaurant(NANCY, demo)
    nancy.price = "$"
    db.session.commit()
    run = app.test_cli_runner()

    dry = run.invoke(args=["seed", "demo-reset", "--dry-run"])
    assert "Would put back:\n  Nancy's Hustle: price" in dry.output

    done = run.invoke(args=["seed", "demo-reset"])
    assert "Put back:\n  Nancy's Hustle: price" in done.output
    assert run.invoke(args=["seed", "demo-reset"]).output.strip() == "The demo account is as seeded; nothing to put back."


# --- what the demo may not do ------------------------------------------------------------

def test_the_demo_cant_delete_its_seeded_restaurants(client, demo):
    nancy = restaurant(NANCY, demo)
    login(client, "demo@aa.io")

    res = client.delete(f"/api/restaurants/{nancy.id}")

    assert res.status_code == 403
    assert res.get_json()["errors"] == [refusals.DELETE_RESTAURANT]
    assert db.session.get(Restaurant, nancy.id) is not None


def test_but_it_can_delete_one_it_made_itself(client, demo):
    login(client, "demo@aa.io")
    made = Restaurant(user_id=demo, name="Visitor's Test", price="$", address="1 Way", city="Austin", state="TX",
                      zipcode="78701", country="USA", phone_number="", website="", description="Testing.")
    db.session.add(made)
    db.session.commit()

    assert client.delete(f"/api/restaurants/{made.id}").status_code == 200


def test_the_demo_can_edit_its_restaurants_but_not_rename_them(client, demo):
    nancy = restaurant(NANCY, demo)
    login(client, "demo@aa.io")

    renamed = client.put(f"/api/restaurants/{nancy.id}", json=body_for(nancy, name="Nancy's Bustle"))
    assert renamed.status_code == 403
    assert renamed.get_json()["errors"] == [refusals.RENAME_RESTAURANT]

    edited = client.put(f"/api/restaurants/{nancy.id}", json=body_for(nancy, price="$$"))
    assert edited.status_code == 200, edited.get_json()
    assert edited.get_json()["price"] == "$$"
    assert edited.get_json()["isDemoRestaurant"] is True
    assert restaurant(NANCY, demo).name == NANCY


def test_the_demo_cant_change_its_profile(client, demo):
    login(client, "demo@aa.io")

    res = client.put(f"/api/users/{demo}/edit", json={"username": "Vandal", "first_name": "Van", "last_name": "Dal"})

    assert res.status_code == 403
    assert res.get_json()["errors"] == [refusals.EDIT_PROFILE]
    assert db.session.get(User, demo).username == "Demo"


def test_photos_on_a_demo_restaurant_go_only_with_whoever_added_them(client, ids, demo):
    nancy = restaurant(NANCY, demo)
    seeded = RestaurantImage.query.filter_by(restaurant_id=nancy.id, url=PHOTOS[1][2]).one()
    theirs = RestaurantImage(restaurant_id=nancy.id, url="https://example.com/theirs.jpg", createdByUserId=ids["bystander"])
    mine = RestaurantImage(restaurant_id=nancy.id, url="https://example.com/mine.jpg", createdByUserId=demo)
    db.session.add_all([theirs, mine])
    db.session.commit()
    seeded_id, theirs_id, mine_id = seeded.id, theirs.id, mine.id

    login(client, "demo@aa.io")
    for image_id in (seeded_id, theirs_id):
        res = client.delete(f"/api/restaurant-images/{image_id}")
        assert res.status_code == 403
        assert res.get_json()["errors"] == [refusals.REMOVE_PHOTO]
    assert client.delete(f"/api/restaurant-images/{mine_id}").status_code == 200

    # Whoever added one can still take it away.
    client.get("/api/auth/logout")
    login(client, "bystander@test.io")
    assert client.delete(f"/api/restaurant-images/{theirs_id}").status_code == 200


def test_someone_elses_restaurant_by_the_same_name_is_theirs_to_delete(client, ids, demo):
    copy = Restaurant(user_id=ids["owner"], name=NANCY, price="$", address="9 Elsewhere", city="Austin", state="TX",
                      zipcode="78701", country="USA", phone_number="", website="", description="Not the demo's.")
    db.session.add(copy)
    db.session.commit()
    login(client, "owner@test.io")

    assert client.delete(f"/api/restaurants/{copy.id}").status_code == 200


# --- what the page is told ------------------------------------------------------------------

def test_the_page_knows_a_demo_restaurant_and_the_demo_account(client, ids, demo):
    nancy = restaurant(NANCY, demo)
    assert client.get(f"/api/restaurants/{nancy.id}").get_json()["isDemoRestaurant"] is True
    assert client.get(f"/api/restaurants/{ids['restaurant']}").get_json()["isDemoRestaurant"] is False

    assert login(client, "demo@aa.io")["isDemo"] is True
    client.get("/api/auth/logout")
    assert login(client, "owner@test.io")["isDemo"] is False
