"""
Pytest fixtures for the Whelp API.

Runs the Flask app against an in-memory SQLite database with a small, known
set of users, one restaurant, one review, and one restaurant image.

    pytest            # from the repo root, inside `pipenv shell`
"""
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Configure before importing the app: it builds its config at import time.
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ["DATABASE_URL"] = "sqlite://"
for var in ("APP_ENV", "FLASK_ENV"):
    os.environ.pop(var, None)
for var in ("S3_BUCKET", "S3_KEY", "S3_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
            "RESEND_API_KEY", "MAIL_FROM", "PUBLIC_URL"):
    os.environ.pop(var, None)

import logging  # noqa: E402

import pytest  # noqa: E402
from flask.testing import FlaskClient  # noqa: E402
from werkzeug.datastructures import Headers  # noqa: E402

from app import app as flask_app  # noqa: E402
from app.extensions import limiter  # noqa: E402
from app.models import db, User, Restaurant, Review, RestaurantImage  # noqa: E402

# The suite signs in dozens of times a second, which is exactly what the limit
# on /api/auth/login is there to stop. Storage is configured either way, so
# tests/test_hardening.py can turn it back on and prove the limit works.
limiter.enabled = False

# Config sets SQLALCHEMY_ECHO=True; keep the SQL out of test output.
for _logger_name in ("sqlalchemy.engine", "sqlalchemy.engine.Engine"):
    logging.getLogger(_logger_name).setLevel(logging.WARNING)
    logging.getLogger(_logger_name).handlers.clear()


class PageClient(FlaskClient):
    """
    A test client that behaves like the app's pages: every request that
    changes something sends the CSRF cookie back as the X-CSRFToken header,
    as `react-app/src/utils/csrf.ts` does (#109). Without the cookie -- no
    GET yet, or a test that deleted it -- nothing is added, and the request
    is refused the way a forged one is.
    """

    def open(self, *args, **kwargs):
        method = str(kwargs.get("method", "GET")).upper()
        if method not in ("GET", "HEAD", "OPTIONS", "TRACE"):
            cookie = self.get_cookie("csrf_token")
            headers = Headers(kwargs.pop("headers", None) or {})
            if cookie is not None and "X-CSRFToken" not in headers:
                headers["X-CSRFToken"] = cookie.value
            kwargs["headers"] = headers
        return super().open(*args, **kwargs)


flask_app.test_client_class = PageClient


@pytest.fixture()
def app():
    flask_app.config.update(TESTING=True, SQLALCHEMY_ECHO=False)
    with flask_app.app_context():
        db.drop_all()
        db.create_all()

        owner = User(username="owner", email="owner@test.io", password="password",
                     first_name="Olive", last_name="Owner")
        reviewer = User(username="reviewer", email="reviewer@test.io", password="password",
                        first_name="Rita", last_name="Reviewer")
        bystander = User(username="bystander", email="bystander@test.io", password="password",
                         first_name="Bob", last_name="Bystander")
        db.session.add_all([owner, reviewer, bystander])
        db.session.commit()

        restaurant = Restaurant(
            user_id=owner.id, name="Test Bistro", price="$$", address="1 Main St", city="Houston",
            state="TX", zipcode="77001", country="USA", phone_number="(555) 555-5555",
            website="http://testbistro.com", description="A place for tests.")
        db.session.add(restaurant)
        db.session.commit()

        review = Review(user_id=reviewer.id, restaurant_id=restaurant.id, review="Solid.", rating=4)
        image = RestaurantImage(restaurant_id=restaurant.id, url="https://example.com/a.jpg",
                                preview=True, createdByUserId=reviewer.id)
        db.session.add_all([review, image])
        db.session.commit()

        yield flask_app

        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def ids(app):
    """Primary keys of the seeded rows, looked up fresh for each test."""
    return {
        "owner": User.query.filter_by(username="owner").one().id,
        "reviewer": User.query.filter_by(username="reviewer").one().id,
        "bystander": User.query.filter_by(username="bystander").one().id,
        "restaurant": Restaurant.query.one().id,
        "review": Review.query.one().id,
        "image": RestaurantImage.query.one().id,
    }


def visit(client):
    """
    Be a signed-out visitor who has a page open. Every response sets the CSRF
    cookie, so they hold one: what refuses them afterwards is the login check,
    not the CSRF one.
    """
    client.get("/api/auth/")


def login(client, email, password="password"):
    """Log a seeded user in. The initial GET hands the client its CSRF cookie."""
    client.get("/api/auth/")
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.get_json()
    return res.get_json()


def critics(count, start=0):
    """
    The ids of `count` people who can each review anything. One person may
    review a restaurant once -- the database holds it (#119) -- so a test
    that wants several reviews wants several reviewers. None of them logs
    in, so none of them costs a password hash.
    """
    users = []
    for number in range(start, start + count):
        username = f"critic{number}"
        user = User.query.filter_by(username=username).first()
        if user is None:
            user = User(username=username, email=f"{username}@test.io", hashed_password="-",
                        first_name="Critic", last_name=str(number))
            db.session.add(user)
        users.append(user)
    db.session.commit()
    return [user.id for user in users]
