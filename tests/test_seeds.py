from app.models import (
    Amenity, Category, Restaurant, RestaurantHours, Review, ReviewResponse, User, db)
from app.seeds.amenities import AMENITIES
from app.seeds.categories import ASSIGNMENTS, CATEGORIES
from app.seeds.hours import HOURS

SEEDED_USERS = 6
SEEDED_RESTAURANTS = 10
SEEDED_REVIEWS = 34
SEEDED_RESPONSES = 11


def test_seed_all_skips_when_database_has_data(app):
    """The deploy build command runs `flask seed all`; it must never wipe real data."""
    runner = app.test_cli_runner()
    before = User.query.count()
    assert before > 0

    result = runner.invoke(args=["seed", "all"])

    assert result.exit_code == 0, result.output
    assert "skipping seed" in result.output
    assert User.query.count() == before
    assert User.query.filter_by(username="owner").first() is not None


def test_seed_all_reset_wipes_and_reseeds(app):
    runner = app.test_cli_runner()

    result = runner.invoke(args=["seed", "all", "--reset"])

    assert result.exit_code == 0, result.output
    assert User.query.filter_by(username="owner").first() is None
    assert User.query.count() == SEEDED_USERS
    assert Restaurant.query.count() == SEEDED_RESTAURANTS
    assert Review.query.count() == SEEDED_REVIEWS
    assert ReviewResponse.query.count() == SEEDED_RESPONSES

    # a plain re-run afterwards is a no-op
    result = runner.invoke(args=["seed", "all"])
    assert result.exit_code == 0, result.output
    assert "skipping seed" in result.output
    assert User.query.count() == SEEDED_USERS


def test_seed_all_populates_an_empty_database(app):
    runner = app.test_cli_runner()

    result = runner.invoke(args=["seed", "undo"])
    assert result.exit_code == 0, result.output
    assert User.query.count() == 0

    result = runner.invoke(args=["seed", "all"])
    assert result.exit_code == 0, result.output
    assert "Seeded the database" in result.output
    assert User.query.count() == SEEDED_USERS
    assert ReviewResponse.query.count() == SEEDED_RESPONSES


def test_the_demo_restaurants_get_their_cuisines(app):
    runner = app.test_cli_runner()

    assert runner.invoke(args=["seed", "all", "--reset"]).exit_code == 0

    assert Category.query.count() == len(CATEGORIES)
    for name, slugs in ASSIGNMENTS.items():
        restaurant = Restaurant.query.filter_by(name=name).one()
        assert sorted(category.slug for category in restaurant.categories) == sorted(slugs), name


def test_the_demo_restaurants_get_their_hours_and_a_timezone(app):
    runner = app.test_cli_runner()

    assert runner.invoke(args=["seed", "all", "--reset"]).exit_code == 0

    assert Amenity.query.count() == len(AMENITIES)
    for name, shifts in HOURS.items():
        restaurant = Restaurant.query.filter_by(name=name).one()
        days = {weekday for group, _, _ in shifts for weekday in group}
        assert {row.weekday for row in restaurant.hours} == days, name
        assert restaurant.timezone, f"{name} needs a timezone to be open in"

    # The four the demo spans, which is the point of storing one at all.
    zones = {r.timezone for r in Restaurant.query.all()}
    assert zones == {"America/Chicago", "America/Los_Angeles", "America/New_York"}


def test_seeding_twice_does_not_double_the_hours(app):
    """`restaurant.hours = [...]` replaces; appending would break the one-row-
    per-day constraint on the second run."""
    runner = app.test_cli_runner()

    assert runner.invoke(args=["seed", "all", "--reset"]).exit_code == 0
    first = RestaurantHours.query.count()
    assert runner.invoke(args=["seed", "all", "--reset"]).exit_code == 0

    assert RestaurantHours.query.count() == first


def test_a_new_category_reaches_a_database_that_is_skipped(app):
    """
    The taxonomy is reference data, not demo data. Every database this command
    would skip is one someone is using, and a cuisine added to the list has to
    reach those -- otherwise the filter bar offers it and nothing has it.
    """
    runner = app.test_cli_runner()
    assert runner.invoke(args=["seed", "all", "--reset"]).exit_code == 0
    Category.query.filter_by(slug=CATEGORIES[0][1]).delete()
    db.session.commit()

    result = runner.invoke(args=["seed", "all"])

    assert result.exit_code == 0, result.output
    assert "skipping seed" in result.output, "the demo data is still left alone"
    assert Category.query.filter_by(slug=CATEGORIES[0][1]).one()
    assert "Added 1 category to the taxonomy" in result.output


def test_undo_clears_saved_restaurants_too(app):
    from app.models import Favorite, User, db
    runner = app.test_cli_runner()
    assert runner.invoke(args=["seed", "all", "--reset"]).exit_code == 0
    db.session.add(Favorite(user_id=User.query.first().id, restaurant_id=Restaurant.query.first().id))
    db.session.commit()

    assert runner.invoke(args=["seed", "undo"]).exit_code == 0

    assert Favorite.query.count() == 0


def test_undo_clears_the_taxonomy_too(app):
    runner = app.test_cli_runner()
    assert runner.invoke(args=["seed", "all", "--reset"]).exit_code == 0

    assert runner.invoke(args=["seed", "undo"]).exit_code == 0

    assert Category.query.count() == 0
    assert Restaurant.query.count() == 0
