"""
One review per person per restaurant, and a rating from 1 to 5, held by the
database -- and a lost race answered with what the check would have said
(#119).

The routes check and then insert. Two requests close together can both pass
the check; the database lets one in and refuses the other. That refusal used
to be a 500. Each race below is simulated by making the check miss once, the
way it misses when the other request commits in between.
"""
import importlib.util
import pathlib

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

import app.api.restaurant_routes as restaurant_routes
import app.api.review_routes as review_routes
from app.models import Review, ReviewResponse, User, db
from tests.conftest import login, visit


def misses_once(real, missed=False):
    """A check that answers `missed` the first time it is asked, then asks for real."""
    asked = []

    def check(*args, **kwargs):
        asked.append(args)
        return missed if len(asked) == 1 else real(*args, **kwargs)
    return check


# --- the database -------------------------------------------------------------------

def test_a_second_review_by_one_person_is_refused(app, ids):
    db.session.add(Review(user_id=ids["reviewer"], restaurant_id=ids["restaurant"], review="Again.", rating=5))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


@pytest.mark.parametrize("rating", [0, 6, -1, 50])
def test_a_rating_outside_one_to_five_is_refused(app, ids, rating):
    db.session.add(Review(user_id=ids["bystander"], restaurant_id=ids["restaurant"], review="Hm.", rating=rating))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


@pytest.mark.parametrize("rating", [1, 5])
def test_the_ends_of_the_range_are_ratings(app, ids, rating):
    db.session.add(Review(user_id=ids["bystander"], restaurant_id=ids["restaurant"], review="Fine.", rating=rating))
    db.session.commit()


def test_any_number_of_deleted_users_reviews_can_stand(app, ids):
    """Their user_id is NULL (#44), and NULLs never clash."""
    db.session.add_all([Review(user_id=None, restaurant_id=ids["restaurant"], review=f"Gone {n}.", rating=3)
                        for n in range(3)])
    db.session.commit()
    assert Review.query.filter_by(restaurant_id=ids["restaurant"], user_id=None).count() == 3


# --- a race lost is a 409 that says why ---------------------------------------------------

def test_a_second_review_posted_at_once_is_told_it_is_a_second(client, ids, monkeypatch):
    monkeypatch.setattr(restaurant_routes, "has_reviewed", misses_once(restaurant_routes.has_reviewed))
    login(client, "reviewer@test.io")  # already reviewed the restaurant, in the fixtures

    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews", json={"review": "Twice?", "rating": 5})

    assert res.status_code == 409
    assert res.get_json()["errors"] == ["You've already reviewed this restaurant"]
    assert Review.query.filter_by(user_id=ids["reviewer"], restaurant_id=ids["restaurant"]).count() == 1


def test_a_second_reply_posted_at_once_is_told_there_is_one(client, ids, monkeypatch):
    login(client, "owner@test.io")
    assert client.post(f"/api/reviews/{ids['review']}/response", json={"response": "Thanks!"}).status_code == 201
    monkeypatch.setattr(review_routes, "has_response", misses_once(review_routes.has_response))

    res = client.post(f"/api/reviews/{ids['review']}/response", json={"response": "Thanks again!"})

    assert res.status_code == 409
    assert res.get_json()["errors"] == [review_routes.ALREADY_ANSWERED]
    assert ReviewResponse.query.filter_by(review_id=ids["review"]).count() == 1


NEWCOMER = {"username": "newbie", "email": "new@example.com", "first_name": "New", "last_name": "Bie",
            "password": "password"}


def test_two_signups_for_one_address_at_once(client, monkeypatch):
    monkeypatch.setattr(User, "with_email", staticmethod(misses_once(User.with_email, missed=None)))
    visit(client)

    res = client.post("/api/auth/signup", json={**NEWCOMER, "email": "owner@test.io"})

    assert res.status_code == 409
    assert res.get_json()["errors"] == ["Email address is already in use."]
    assert User.query.count() == 3


def test_two_signups_for_one_username_at_once(client, monkeypatch):
    monkeypatch.setattr(User, "username_taken", staticmethod(misses_once(User.username_taken)))
    visit(client)

    res = client.post("/api/auth/signup", json={**NEWCOMER, "username": "owner"})

    assert res.status_code == 409
    assert res.get_json()["errors"] == ["Username is already in use."]
    assert User.query.count() == 3


def test_taking_a_username_someone_took_a_moment_ago(client, ids, monkeypatch):
    login(client, "owner@test.io")
    monkeypatch.setattr(User, "username_taken", staticmethod(misses_once(User.username_taken)))

    res = client.put(f"/api/users/{ids['owner']}/edit", json={"username": "reviewer"})

    assert res.status_code == 409
    assert res.get_json()["errors"] == ["Username is already in use."]
    assert db.session.get(User, ids["owner"]).username == "owner"


def test_a_refusal_that_is_not_the_race_is_not_passed_off_as_one(client, ids, monkeypatch):
    """Something else went wrong: saying "already reviewed" would be a lie."""
    login(client, "bystander@test.io")

    def refuse(*args, **kwargs):
        raise IntegrityError("INSERT INTO reviews ...", {}, Exception("FOREIGN KEY constraint failed"))

    monkeypatch.setattr(db.session, "commit", refuse)
    # Not answered as a 409: raised, as any bug is under test -- and a 500 in
    # production (test_error_shape covers that).
    with pytest.raises(IntegrityError):
        client.post(f"/api/restaurants/{ids['restaurant']}/reviews", json={"review": "Nice.", "rating": 4})


# --- the migration --------------------------------------------------------------------

MIGRATION = (pathlib.Path(__file__).resolve().parents[1] / "migrations" / "versions"
             / "e3a8c1f5d927_one_review_per_person_and_a_rating_range.py")


@pytest.fixture()
def migration():
    spec = importlib.util.spec_from_file_location("review_integrity", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(step, connection):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    with Operations.context(MigrationContext.configure(connection)):
        step()


def reviews_table(connection, *rows):
    connection.execute(text(
        "CREATE TABLE reviews (id INTEGER PRIMARY KEY, user_id INTEGER, restaurant_id INTEGER NOT NULL,"
        " review VARCHAR(255) NOT NULL, rating INTEGER NOT NULL)"))
    for number, (user_id, restaurant_id, rating) in enumerate(rows, start=1):
        connection.execute(text(
            "INSERT INTO reviews (id, user_id, restaurant_id, review, rating) VALUES (:id, :user, :place, 'x', :rating)"),
            {"id": number, "user": user_id, "place": restaurant_id, "rating": rating})


def insert(connection, number, user_id, restaurant_id, rating):
    connection.execute(text(
        "INSERT INTO reviews (id, user_id, restaurant_id, review, rating) VALUES (:id, :user, :place, 'x', :rating)"),
        {"id": number, "user": user_id, "place": restaurant_id, "rating": rating})


def test_the_migration_stops_and_names_duplicates_and_bad_ratings(migration, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}")
    with engine.begin() as connection:
        reviews_table(connection, (1, 10, 4), (1, 10, 5), (2, 10, 7), (None, 10, 3), (None, 10, 3))
        with pytest.raises(RuntimeError) as refused:
            run(migration.upgrade, connection)
        message = str(refused.value)
        assert "user 1 on restaurant 10 (2 reviews)" in message
        assert "review 3 (rating 7)" in message
        assert "None" not in message  # deleted users' reviews are not duplicates
        assert connection.execute(text("SELECT COUNT(*) FROM reviews")).scalar() == 5  # nothing touched


def test_the_migration_then_holds_both_rules(migration, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}")
    with engine.begin() as connection:
        reviews_table(connection, (1, 10, 4), (None, 10, 3), (None, 10, 3))
        run(migration.upgrade, connection)
        with pytest.raises(IntegrityError):
            insert(connection, 4, 1, 10, 5)
    with engine.begin() as connection:
        with pytest.raises(IntegrityError):
            insert(connection, 5, 2, 10, 6)
    with engine.begin() as connection:
        insert(connection, 6, None, 10, 1)  # another deleted user's review is fine
        insert(connection, 7, 1, 11, 5)     # and the same person, another restaurant


def test_the_migration_can_be_undone(migration, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}")
    with engine.begin() as connection:
        reviews_table(connection, (1, 10, 4))
        run(migration.upgrade, connection)
        run(migration.downgrade, connection)
        insert(connection, 2, 1, 10, 9)
