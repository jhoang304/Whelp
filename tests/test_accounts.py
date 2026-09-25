"""
Changing a password, and deleting an account.

The deletion rule (#44): the account and everything only it owns go -- the
restaurants it owns with all that is on them, every photo it added, its saved
list, its avatar. The reviews it wrote stay, with no author, shown as by
"Deleted user": they are part of other businesses' ratings.

In the fixture, `owner` owns Test Bistro, `reviewer` wrote its one review and
added its one photo, and `bystander` is neither.
"""
import importlib.util
import pathlib
from datetime import time

import pytest
from sqlalchemy import create_engine, text

from app.models import (
    Favorite, Restaurant, RestaurantHours, RestaurantImage, Review, ReviewImage,
    ReviewResponse, User, db)
from tests.conftest import login
from tests.test_images import configure_s3


def change_password(client, user_id, current, new):
    return client.put(f"/api/users/{user_id}/password",
                      json={"current_password": current, "new_password": new})


def delete(client, user_id, password="password"):
    return client.delete(f"/api/users/{user_id}", json={"password": password})


def make_demo():
    demo = User(username="Demo", email="demo@aa.io", password="password",
                first_name="Demo", last_name="User")
    db.session.add(demo)
    db.session.commit()
    return demo.id


# --- changing a password ------------------------------------------------------

def test_a_password_can_be_changed_with_the_current_one(client, ids):
    login(client, "bystander@test.io")

    res = change_password(client, ids["bystander"], "password", "a-new-password")

    assert res.status_code == 200, res.get_json()
    client.get("/api/auth/logout")
    assert client.post("/api/auth/login", json={"email": "bystander@test.io",
                                                "password": "password"}).status_code == 401
    login(client, "bystander@test.io", "a-new-password")


def test_the_wrong_current_password_changes_nothing(client, ids):
    login(client, "bystander@test.io")

    res = change_password(client, ids["bystander"], "not-it", "a-new-password")

    assert res.status_code == 400
    assert res.get_json() == {"errors": ["Your current password is incorrect."]}
    assert db.session.get(User, ids["bystander"]).check_password("password")


def test_the_new_password_follows_the_signup_rule(client, ids):
    login(client, "bystander@test.io")

    res = change_password(client, ids["bystander"], "password", "short")

    assert res.status_code == 400
    assert res.get_json() == {"errors": ["Password must be at least 8 characters."]}


def test_the_new_password_must_be_new(client, ids):
    login(client, "bystander@test.io")

    res = change_password(client, ids["bystander"], "password", "password")

    assert res.status_code == 400
    assert res.get_json() == {
        "errors": ["Choose a new password that is different from your current one."]}


def test_nobody_changes_anyone_elses_password(client, ids):
    login(client, "bystander@test.io")

    res = change_password(client, ids["reviewer"], "password", "a-new-password")

    assert res.status_code == 403
    assert db.session.get(User, ids["reviewer"]).check_password("password")


def test_changing_a_password_needs_someone_logged_in(client, ids):
    assert change_password(client, ids["bystander"], "password", "a-new-password").status_code in (302, 401)


def test_the_demo_accounts_password_cannot_change(client, ids):
    """Everyone who tries the site logs in as the demo user with this password."""
    demo_id = make_demo()
    login(client, "demo@aa.io")

    res = change_password(client, demo_id, "password", "a-new-password")

    assert res.status_code == 403
    assert db.session.get(User, demo_id).check_password("password")


# --- what deleting would do ---------------------------------------------------

def test_the_summary_lists_what_would_go(client, ids):
    db.session.add(Favorite(user_id=ids["owner"], restaurant_id=ids["restaurant"]))
    db.session.commit()
    login(client, "owner@test.io")

    res = client.get(f"/api/users/{ids['owner']}/deletion")

    assert res.status_code == 200
    assert res.get_json() == {
        "restaurants": [{"id": ids["restaurant"], "name": "Test Bistro", "reviews": 1}],
        "reviewsKept": 0,
        "photos": 0,  # the bistro's one photo is the reviewer's
        "favorites": 1,
        "isDemo": False,
    }


def test_the_summary_counts_a_reviewers_review_and_photos(client, ids):
    db.session.add(ReviewImage(review_id=ids["review"], url="https://example.com/r.png"))
    db.session.commit()
    login(client, "reviewer@test.io")

    body = client.get(f"/api/users/{ids['reviewer']}/deletion").get_json()

    assert body["restaurants"] == []
    assert body["reviewsKept"] == 1
    assert body["photos"] == 2  # one on the restaurant, one on the review


def test_nobody_sees_anyone_elses_summary(client, ids):
    login(client, "bystander@test.io")
    assert client.get(f"/api/users/{ids['owner']}/deletion").status_code == 403


# --- deleting -----------------------------------------------------------------

def test_a_reviewers_reviews_stay_but_are_nobodys(client, ids):
    db.session.add(ReviewResponse(review_id=ids["review"], user_id=ids["owner"],
                                  response="Thanks for coming!"))
    db.session.commit()
    login(client, "reviewer@test.io")

    res = delete(client, ids["reviewer"])

    assert res.status_code == 200, res.get_json()
    assert db.session.get(User, ids["reviewer"]) is None
    review = db.session.get(Review, ids["review"])
    assert review is not None and review.user_id is None
    # Still part of the rating, and still answered.
    detail = client.get(f"/api/restaurants/{ids['restaurant']}").get_json()
    assert detail["numReviews"] == 1 and detail["avgStarRating"] == 4
    listed = client.get(f"/api/restaurants/{ids['restaurant']}/reviews").get_json()["items"]
    assert listed[0]["user"] is None
    assert listed[0]["response"]["response"] == "Thanks for coming!"


def test_a_reviewers_photos_go_everywhere(client, ids):
    db.session.add(ReviewImage(review_id=ids["review"], url="https://example.com/r.png"))
    db.session.commit()
    login(client, "reviewer@test.io")

    delete(client, ids["reviewer"])

    # The photo they added to someone else's restaurant, and the one on their review.
    assert RestaurantImage.query.count() == 0
    assert ReviewImage.query.count() == 0
    assert db.session.get(Restaurant, ids["restaurant"]) is not None


def test_an_owners_restaurants_go_with_everything_on_them(client, ids):
    db.session.add(RestaurantHours(restaurant_id=ids["restaurant"], weekday=0,
                                   opens=time(9), closes=time(17)))
    # Someone else's save, and someone else's review, of the owner's restaurant.
    db.session.add(Favorite(user_id=ids["bystander"], restaurant_id=ids["restaurant"]))
    db.session.commit()
    login(client, "owner@test.io")

    assert delete(client, ids["owner"]).status_code == 200

    assert Restaurant.query.count() == 0
    assert Review.query.count() == 0
    assert RestaurantImage.query.count() == 0
    assert RestaurantHours.query.count() == 0
    assert Favorite.query.count() == 0
    # Nobody else was touched.
    assert {user.username for user in User.query.all()} == {"reviewer", "bystander"}


def test_their_saved_list_goes(client, ids):
    db.session.add(Favorite(user_id=ids["bystander"], restaurant_id=ids["restaurant"]))
    db.session.commit()
    login(client, "bystander@test.io")

    delete(client, ids["bystander"])

    assert Favorite.query.count() == 0
    assert db.session.get(Restaurant, ids["restaurant"]) is not None


def test_deleting_logs_you_out(client, ids):
    login(client, "bystander@test.io")

    delete(client, ids["bystander"])

    assert client.get("/api/auth/").status_code == 401


def test_the_wrong_password_deletes_nothing(client, ids):
    login(client, "owner@test.io")

    res = delete(client, ids["owner"], "not-it")

    assert res.status_code == 400
    assert res.get_json() == {"errors": ["That password is incorrect."]}
    assert db.session.get(User, ids["owner"]) is not None
    assert Restaurant.query.count() == 1


def test_a_password_is_required(client, ids):
    login(client, "owner@test.io")

    res = client.delete(f"/api/users/{ids['owner']}", json={})

    assert res.status_code == 400
    assert res.get_json() == {"errors": ["Enter your password to delete your account."]}
    assert db.session.get(User, ids["owner"]) is not None


def test_nobody_deletes_anyone_else(client, ids):
    login(client, "bystander@test.io")

    res = delete(client, ids["owner"])

    assert res.status_code == 403
    assert db.session.get(User, ids["owner"]) is not None


def test_the_demo_account_cannot_be_deleted(client, ids):
    demo_id = make_demo()
    login(client, "demo@aa.io")

    res = delete(client, demo_id)

    assert res.status_code == 403
    assert db.session.get(User, demo_id) is not None
    assert client.get(f"/api/users/{demo_id}/deletion").get_json()["isDemo"] is True


def test_their_objects_leave_the_bucket_and_nobody_elses_do(client, ids, monkeypatch):
    configure_s3(monkeypatch)
    removed = []
    monkeypatch.setattr("app.api.accounts.remove_keys_from_s3", lambda keys: removed.extend(keys))

    reviewer = db.session.get(User, ids["reviewer"])
    reviewer.profile_image_key = f"uploads/{ids['reviewer']}/me.png"
    image = db.session.get(RestaurantImage, ids["image"])
    image.s3_key = f"uploads/{ids['reviewer']}/dish.png"
    db.session.add(ReviewImage(review_id=ids["review"], url="https://example.com/r.png",
                               s3_key=f"uploads/{ids['reviewer']}/plate.png"))
    # The owner's avatar happens to be the same object as one of the
    # reviewer's photos: it is still referenced, so it stays.
    db.session.get(User, ids["owner"]).profile_image_key = f"uploads/{ids['reviewer']}/shared.png"
    db.session.add(RestaurantImage(restaurant_id=ids["restaurant"], url="https://example.com/s.png",
                                   createdByUserId=ids["reviewer"],
                                   s3_key=f"uploads/{ids['reviewer']}/shared.png"))
    db.session.commit()
    login(client, "reviewer@test.io")

    delete(client, ids["reviewer"])

    assert sorted(removed) == sorted([
        f"uploads/{ids['reviewer']}/dish.png",
        f"uploads/{ids['reviewer']}/me.png",
        f"uploads/{ids['reviewer']}/plate.png",
    ])


def test_an_owners_restaurants_take_their_objects_with_them(client, ids, monkeypatch):
    """Every object on a deleted restaurant goes, whoever added it."""
    configure_s3(monkeypatch)
    removed = []
    monkeypatch.setattr("app.api.accounts.remove_keys_from_s3", lambda keys: removed.extend(keys))
    db.session.get(RestaurantImage, ids["image"]).s3_key = f"uploads/{ids['reviewer']}/dish.png"
    db.session.add(ReviewImage(review_id=ids["review"], url="https://example.com/r.png",
                               s3_key=f"uploads/{ids['reviewer']}/plate.png"))
    db.session.commit()
    login(client, "owner@test.io")

    delete(client, ids["owner"])

    assert sorted(removed) == sorted([
        f"uploads/{ids['reviewer']}/dish.png",
        f"uploads/{ids['reviewer']}/plate.png",
    ])


def test_an_anonymous_review_can_be_edited_by_nobody(client, ids):
    login(client, "reviewer@test.io")
    delete(client, ids["reviewer"])
    login(client, "owner@test.io")

    res = client.put(f"/api/reviews/{ids['review']}", json={"review": "Mine now", "rating": 1})

    assert res.status_code == 403
    assert db.session.get(Review, ids["review"]).review == "Solid."


# --- the migration ------------------------------------------------------------

MIGRATION = (pathlib.Path(__file__).resolve().parents[1] / "migrations" / "versions"
             / "c5f1e8a3b927_reviews_outlive_their_authors.py")


@pytest.fixture()
def migration():
    spec = importlib.util.spec_from_file_location("authorless_reviews", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(migration_step, connection):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    with Operations.context(MigrationContext.configure(connection)):
        migration_step()


def test_the_migration_lets_a_review_lose_its_author_and_will_not_undo_that_silently(migration, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        connection.execute(text(
            "CREATE TABLE reviews (id INTEGER PRIMARY KEY,"
            " user_id INTEGER NOT NULL REFERENCES users(id), review VARCHAR(255))"))

        run(migration.upgrade, connection)
        connection.execute(text("INSERT INTO reviews (id, user_id, review) VALUES (1, NULL, 'Solid.')"))

        with pytest.raises(RuntimeError, match="1 review"):
            run(migration.downgrade, connection)

        connection.execute(text("DELETE FROM reviews"))
        run(migration.downgrade, connection)
        with pytest.raises(Exception):
            connection.execute(text("INSERT INTO reviews (id, user_id, review) VALUES (2, NULL, 'x')"))
