"""
`flask seed backfill`: the details production never got, and nothing more.

Production is a populated database, so `flask seed all` has skipped it on
every deploy since the first: it has the restaurants and the vocabularies,
and none of the cuisines, amenities or hours that join them. The test that
matters most below builds exactly that database and checks the backfill
turns it into what a fresh seed would have been.

The others are about what it must not do. It runs against real data, so it
fills only what is empty, never guesses between two restaurants with one
name, and writes nothing unless told to.
"""
from datetime import time

from app.models import (
    Amenity, Category, Restaurant, RestaurantHours, db,
    restaurant_amenities, restaurant_categories)
from app.seeds.amenities import ASSIGNMENTS as AMENITY_ASSIGNMENTS, ensure_amenities
from app.seeds.categories import ASSIGNMENTS as CATEGORY_ASSIGNMENTS, ensure_categories
from app.seeds.hours import HOURS


def run(app, *args):
    result = app.test_cli_runner().invoke(args=["seed", "backfill", *args])
    assert result.exit_code == 0, result.output
    return result.output


def demo_restaurant(owner_id, name="Uchi", state="TX"):
    restaurant = Restaurant(
        user_id=owner_id, name=name, price="$$$$", address="904 Westheimer Rd",
        city="Houston", state=state, zipcode="77006", country="USA",
        phone_number="(713) 522-4808", website="http://uchihouston.com",
        description="Japanese.")
    db.session.add(restaurant)
    db.session.commit()
    return restaurant.id


def looks_like_production(app):
    """
    A full demo database with its details stripped: the vocabularies and the
    restaurants, and nothing joining them -- what a database seeded before
    those features, then migrated, actually contains.
    """
    assert app.test_cli_runner().invoke(args=["seed", "all", "--reset"]).exit_code == 0
    db.session.execute(restaurant_categories.delete())
    db.session.execute(restaurant_amenities.delete())
    RestaurantHours.query.delete()
    for restaurant in Restaurant.query.all():
        restaurant.timezone = None
    db.session.commit()


def test_it_turns_production_into_what_a_fresh_seed_would_be(app):
    looks_like_production(app)

    output = run(app, "--apply")

    assert "Gave 10 restaurants" in output
    for name, slugs in CATEGORY_ASSIGNMENTS.items():
        restaurant = Restaurant.query.filter_by(name=name).one()
        assert sorted(c.slug for c in restaurant.categories) == sorted(slugs), name
        assert sorted(a.slug for a in restaurant.amenities) == sorted(AMENITY_ASSIGNMENTS[name]), name
        days = {weekday for group, _, _ in HOURS[name] for weekday in group}
        assert {row.weekday for row in restaurant.hours} == days, name
        assert restaurant.timezone, name


def test_by_default_it_only_says_what_it_would_do(app):
    looks_like_production(app)

    output = run(app)

    assert "Would give 10 restaurants" in output
    assert "Nothing was written" in output
    assert RestaurantHours.query.count() == 0
    assert db.session.query(restaurant_categories).count() == 0
    assert db.session.query(restaurant_amenities).count() == 0
    assert all(r.timezone is None for r in Restaurant.query.all())


def test_running_it_twice_changes_nothing_the_second_time(app):
    looks_like_production(app)
    run(app, "--apply")
    hours_after_first = RestaurantHours.query.count()

    output = run(app, "--apply")

    assert "Nothing to fill in" in output
    assert RestaurantHours.query.count() == hours_after_first


def test_hours_an_owner_set_are_kept(app, ids):
    """The whole reason it fills rather than replaces."""
    restaurant_id = demo_restaurant(ids["owner"])
    restaurant = db.session.get(Restaurant, restaurant_id)
    restaurant.hours = [RestaurantHours(weekday=0, opens=time(6, 0), closes=time(7, 0))]
    db.session.commit()

    run(app, "--apply")

    rows = db.session.get(Restaurant, restaurant_id).hours
    assert [(row.weekday, row.opens) for row in rows] == [(0, time(6, 0))]


def test_cuisines_and_amenities_an_owner_set_are_kept(app, ids):
    ensure_categories()
    ensure_amenities()
    restaurant_id = demo_restaurant(ids["owner"])
    restaurant = db.session.get(Restaurant, restaurant_id)
    restaurant.categories = [Category.query.filter_by(slug="pizza").one()]
    restaurant.amenities = [Amenity.query.filter_by(slug="wifi").one()]
    db.session.commit()

    run(app, "--apply")

    restaurant = db.session.get(Restaurant, restaurant_id)
    assert [c.slug for c in restaurant.categories] == ["pizza"]
    assert [a.slug for a in restaurant.amenities] == ["wifi"]
    assert len(restaurant.hours) == 7, "what was empty is still filled in"


def test_a_timezone_an_owner_chose_is_kept(app, ids):
    """Texas suggests Central, but this one is in El Paso."""
    restaurant_id = demo_restaurant(ids["owner"])
    db.session.get(Restaurant, restaurant_id).timezone = "America/Denver"
    db.session.commit()

    run(app, "--apply")

    assert db.session.get(Restaurant, restaurant_id).timezone == "America/Denver"


def test_two_restaurants_with_one_demo_name_are_both_left_alone(app, ids):
    first = demo_restaurant(ids["owner"])
    second = demo_restaurant(ids["reviewer"])

    output = run(app, "--apply")

    assert "More than one restaurant by this name" in output
    assert "Uchi" in output
    for restaurant_id in (first, second):
        assert db.session.get(Restaurant, restaurant_id).hours == []


def test_demo_restaurants_that_are_gone_are_reported_not_invented(app, ids):
    demo_restaurant(ids["owner"])  # only Uchi exists

    output = run(app, "--apply")

    assert "Gave 1 restaurant " in output
    assert "Not in this database" in output
    assert "Nancy's Hustle" in output
    assert Restaurant.query.filter_by(name="Nancy's Hustle").first() is None


def test_restaurants_that_are_not_demos_are_never_touched(app, ids):
    """The fixture's Test Bistro is somebody's real restaurant, as far as this knows."""
    run(app, "--apply")

    bistro = db.session.get(Restaurant, ids["restaurant"])
    assert bistro.hours == []
    assert bistro.categories == []
    assert bistro.amenities == []
    assert bistro.timezone is None
