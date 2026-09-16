"""
Which methods each URL answers, what a missing CSRF cookie costs, and what an
unknown path returns.
"""
from datetime import datetime

from werkzeug.exceptions import NotFound

from app.models import Restaurant, RestaurantImage, db
from tests.conftest import login


def payload(**overrides):
    body = {
        "name": "Renamed Bistro",
        "price": "$$",
        "address": "2 Side St",
        "city": "Austin",
        "state": "TX",
        "zipcode": "78701",
        "country": "USA",
        "phone_number": "(555) 111-2222",
        "website": "http://renamed.com",
        "description": "Now under new management.",
    }
    body.update(overrides)
    return body


def test_public_gets_do_not_depend_on_rule_ordering(client, ids):
    """
    Each of these URLs also had a login_required mutating rule declaring GET,
    so which handler answered came down to how Werkzeug sorted the rules.
    Logged in is the interesting case: the mutating rule would match too.
    """
    login(client, "owner@test.io")

    listing = client.get("/api/restaurants/")
    assert listing.status_code == 200
    assert "Restaurants" in listing.get_json()

    detail = client.get(f"/api/restaurants/{ids['restaurant']}")
    assert detail.status_code == 200
    assert detail.get_json()["avgStarRating"] == 4  # only the detail handler sends this

    reviews = client.get(f"/api/restaurants/{ids['restaurant']}/reviews")
    assert reviews.status_code == 200
    assert len(reviews.get_json()["reviews"]) == 1

    own_reviews = client.get(f"/api/reviews/{ids['reviewer']}")
    assert own_reviews.status_code == 200
    assert isinstance(own_reviews.get_json(), list)


def test_get_on_a_post_only_route_never_reaches_the_handler(client, ids):
    """Neither `/images` URL has a public GET, so a GET is just an unknown path."""
    login(client, "owner@test.io")
    for url in (f"/api/restaurants/{ids['restaurant']}/images",
                f"/api/reviews/{ids['review']}/images"):
        res = client.get(url)
        assert res.status_code == 404, url
        assert res.get_json() == {"errors": ["Not found"]}, url


def test_every_restaurant_url_belongs_to_the_restaurant_blueprint(app):
    """Two review handlers used to decorate the restaurant blueprint from the
    review module, which is how they ended up on the wrong side of the split."""
    for rule in app.url_map.iter_rules():
        if rule.rule.startswith("/api/restaurants/"):
            assert rule.endpoint.startswith("restaurants."), rule


def test_signup_without_a_csrf_cookie_is_a_400(app):
    """A client that POSTs before any GET has no csrf cookie; this used to
    raise KeyError and come back as a 500."""
    fresh = app.test_client()
    res = fresh.post("/api/auth/signup", json={
        "username": "newcomer",
        "email": "newcomer@test.io",
        "first_name": "New",
        "last_name": "Comer",
        "password": "password",
    })
    assert res.status_code == 400
    assert any("csrf" in message.lower() for message in res.get_json()["errors"])


def test_login_without_a_csrf_cookie_is_refused_not_crashed(app):
    """Login answers 401 for every rejected attempt, rather than telling an
    unauthenticated caller which half of the request it disliked."""
    fresh = app.test_client()
    res = fresh.post("/api/auth/login", json={"email": "owner@test.io", "password": "password"})
    assert res.status_code == 401


def test_editing_without_a_csrf_cookie_is_a_400(client, ids):
    login(client, "owner@test.io")
    client.delete_cookie("localhost", "csrf_token")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload())
    assert res.status_code == 400
    assert any("csrf" in message.lower() for message in res.get_json()["errors"])
    assert Restaurant.query.get(ids["restaurant"]).name == "Test Bistro"


def test_editing_a_restaurant_moves_updatedAt(client, ids):
    restaurant = Restaurant.query.get(ids["restaurant"])
    restaurant.updatedAt = datetime(2020, 1, 1)
    db.session.commit()

    login(client, "owner@test.io")
    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload())
    assert res.status_code == 200, res.get_json()
    assert Restaurant.query.get(ids["restaurant"]).updatedAt > datetime(2020, 1, 1)


def test_updatedAt_moves_for_models_no_route_sets_by_hand(ids):
    """`onupdate` on the column, so this holds wherever a row is written."""
    image = RestaurantImage.query.get(ids["image"])
    image.updatedAt = datetime(2020, 1, 1)
    db.session.commit()

    image.preview = False
    db.session.commit()
    assert RestaurantImage.query.get(ids["image"]).updatedAt > datetime(2020, 1, 1)


def test_an_unknown_api_path_is_a_json_404(client):
    """It used to answer with the React app's HTML, at status 200."""
    res = client.get("/api/not-a-real-endpoint")
    assert res.status_code == 404
    assert res.get_json() == {"errors": ["Not found"]}
    assert res.mimetype == "application/json"


def test_an_unknown_page_path_still_serves_the_react_app(client, app, monkeypatch):
    """Client-side routes only exist in the bundle, so the server hands over
    index.html and lets the router read the path."""
    def only_index(filename):
        # Stand in for a real build: every other file is genuinely missing.
        if filename != "index.html":
            raise NotFound()
        return "stub:index.html"

    monkeypatch.setattr(app, "send_static_file", only_index)

    res = client.get("/restaurants/1/some-client-route")
    assert res.status_code == 200
    assert res.get_data(as_text=True) == "stub:index.html"
