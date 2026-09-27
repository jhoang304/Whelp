"""
CSRF on every change, the session cookie's flags, and the security headers
(#109).

A forged request -- a form or script on another site aimed at Whelp -- gets
the victim's cookies attached by the browser, csrf_token included. What it
cannot do is read that cookie to put the token in an X-CSRFToken header, so
every POST, PUT, PATCH and DELETE must carry the header. The test client
(tests/conftest.py, PageClient) adds it the way the app's pages do; passing
an empty header here plays the forger, who has the cookie and nothing else.
"""
import importlib

from app.models import Favorite, Restaurant, RestaurantImage, Review, db
from tests.conftest import login

FORGED = {"X-CSRFToken": ""}


def refused_as_forged(res):
    assert res.status_code == 400, res.get_json()
    assert any("csrf" in message.lower() for message in res.get_json()["errors"])


def test_routes_without_a_form_now_check_the_token(client, ids):
    """Favorites, deletes and set cover had no check at all: a cross-site form could save for you."""
    login(client, "owner@test.io")

    refused_as_forged(client.post(f"/api/restaurants/{ids['restaurant']}/favorite", headers=FORGED))
    refused_as_forged(client.put(f"/api/restaurant-images/{ids['image']}/cover", headers=FORGED))
    refused_as_forged(client.delete(f"/api/restaurant-images/{ids['image']}", headers=FORGED))
    refused_as_forged(client.delete(f"/api/restaurants/{ids['restaurant']}", headers=FORGED))

    assert Favorite.query.count() == 0
    assert db.session.get(RestaurantImage, ids["image"]) is not None
    assert db.session.get(Restaurant, ids["restaurant"]) is not None


def test_a_reviewers_delete_needs_the_token_too(client, ids):
    login(client, "reviewer@test.io")
    refused_as_forged(client.delete(f"/api/reviews/{ids['review']}", headers=FORGED))
    assert db.session.get(Review, ids["review"]) is not None


def test_a_made_up_token_is_refused(client, ids):
    login(client, "owner@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/favorite",
                      headers={"X-CSRFToken": "not-the-token"})
    assert res.status_code == 400
    assert Favorite.query.count() == 0


def test_with_the_token_the_same_changes_go_through(client, ids):
    login(client, "owner@test.io")
    assert client.post(f"/api/restaurants/{ids['restaurant']}/favorite").status_code == 201
    assert client.delete(f"/api/restaurants/{ids['restaurant']}/favorite").status_code == 200


def test_reading_needs_no_token(client, ids):
    assert client.get(f"/api/restaurants/{ids['restaurant']}", headers=FORGED).status_code == 200


def set_cookies(res):
    return {header.split("=", 1)[0]: header for header in res.headers.getlist("Set-Cookie")}


def test_the_csrf_cookie_is_readable_by_the_page(client):
    """The page reads it to send it back; HttpOnly would hide it from the page."""
    cookie = set_cookies(client.get("/api/auth/"))["csrf_token"]
    assert "httponly" not in cookie.lower()


def test_the_session_cookie_stays_off_other_sites_requests(client):
    client.get("/api/auth/")
    res = client.post("/api/auth/login", json={"email": "owner@test.io", "password": "password"})
    cookie = set_cookies(res)["session"]
    assert "samesite=lax" in cookie.lower()
    assert "httponly" in cookie.lower()


def test_production_sends_the_cookies_over_https_only(monkeypatch):
    import app.config

    monkeypatch.setenv("APP_ENV", "production")
    try:
        production = importlib.reload(app.config).Config
        assert production.SESSION_COOKIE_SECURE is True
        assert production.SESSION_COOKIE_SAMESITE == "Lax"
        assert production.REMEMBER_COOKIE_SECURE is True
    finally:
        monkeypatch.delenv("APP_ENV")
        development = importlib.reload(app.config).Config
    # Local http development still works: a Secure cookie would never be sent.
    assert development.SESSION_COOKIE_SECURE is False


def test_every_response_carries_the_security_headers(client):
    for path in ("/api/auth/", "/api/restaurants/", "/", "/single/1"):
        res = client.get(path)
        assert res.headers["X-Content-Type-Options"] == "nosniff", path
        assert res.headers["X-Frame-Options"] == "DENY", path
        assert res.headers["Referrer-Policy"] == "strict-origin-when-cross-origin", path
        # Not over plain http in development.
        assert "Strict-Transport-Security" not in res.headers, path


def test_production_tells_browsers_to_use_https(client, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    res = client.get("/api/restaurants/", headers={"X-Forwarded-Proto": "https"})
    assert res.headers["Strict-Transport-Security"] == "max-age=31536000; includeSubDomains"
