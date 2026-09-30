"""
The backend's own behaviour when things go wrong, and what it leaves behind
(#129).
"""
import warnings

import pytest
from sqlalchemy import event
from sqlalchemy.exc import SAWarning

from app import react_root
from app.models import Restaurant, RestaurantImage, db
from tests.conftest import login, visit


def break_the_listing(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("boom")
    monkeypatch.setattr("app.api.restaurant_routes.restaurant_cards", boom)


# --- 1. a bug is raised where someone is there to read it --------------------------------
# Flask's config always holds PROPAGATE_EXCEPTIONS (None unless set), so the
# fallback to testing/debug never applied: a bug was a JSON 500 under pytest and
# under FLASK_DEBUG, with the traceback swallowed.

def test_a_bug_in_a_route_is_raised_under_test(client, monkeypatch):
    break_the_listing(monkeypatch)
    with pytest.raises(RuntimeError, match="boom"):
        client.get("/api/restaurants/")


def test_a_bug_in_a_route_is_raised_in_debug(client, app, monkeypatch):
    monkeypatch.setitem(app.config, "TESTING", False)
    monkeypatch.setitem(app.config, "DEBUG", True)
    break_the_listing(monkeypatch)
    with pytest.raises(RuntimeError, match="boom"):
        client.get("/api/restaurants/")


def test_a_bug_in_production_is_the_documented_shape(client, app, monkeypatch):
    # Neither testing nor debug, and PROPAGATE_EXCEPTIONS left as Flask has it.
    monkeypatch.setitem(app.config, "TESTING", False)
    monkeypatch.setitem(app.config, "DEBUG", False)
    monkeypatch.setitem(app.config, "PROPAGATE_EXCEPTIONS", None)
    break_the_listing(monkeypatch)

    res = client.get("/api/restaurants/")

    assert res.status_code == 500
    assert res.get_json() == {"errors": ["Something went wrong on our end."]}


# --- 2. unknown API paths and methods -----------------------------------------------------

def test_the_catch_all_answers_an_api_path_with_json_not_a_name_error(app):
    """react_root called api_not_found(), which was never defined."""
    with app.test_request_context("/api/no-such-thing"):
        body, status = react_root("api/no-such-thing")
    assert (status, body) == (404, {"errors": ["Not found"]})


@pytest.mark.parametrize("method", ["POST", "PUT", "DELETE"])
def test_any_method_on_a_path_the_api_does_not_have_is_a_404(client, method):
    # It was a 405 offering GET: the SPA's catch-all takes GET on every path.
    visit(client)
    res = client.open("/api/not-a-real-endpoint", method=method, json={})
    assert res.status_code == 404
    assert res.get_json() == {"errors": ["Not found"]}


def test_a_wrong_method_is_offered_only_what_the_api_takes(client, ids):
    # PUT on the photos path offered GET, itself a 405 there.
    login(client, "owner@test.io")
    res = client.put(f"/api/restaurants/{ids['restaurant']}/images", json={})
    assert res.status_code == 405
    assert res.headers["Allow"] == "POST"
    assert res.get_json() == {"errors": ["Method not allowed"]}


def test_a_real_path_still_lists_its_real_methods(client, ids):
    login(client, "owner@test.io")
    res = client.open(f"/api/restaurants/{ids['restaurant']}", method="PATCH")
    assert res.status_code == 405
    assert res.headers["Allow"] == "DELETE, GET, PUT"


def test_the_photos_of_a_restaurant_that_isnt_there_are_a_404(client):
    # They were 200 [], as if it had no photos.
    res = client.get("/api/restaurant-images/99999/images")
    assert res.status_code == 404
    assert res.get_json() == {"errors": ["Restaurant couldn't be found"]}


def test_photos_are_listed_in_id_order(client, ids):
    """Without an ORDER BY the order is the database's, and on Postgres it moves."""
    statements = []

    def record(conn, cursor, statement, *args):
        if "FROM restaurant_images" in statement:
            statements.append(statement)

    event.listen(db.engine, "before_cursor_execute", record)
    try:
        listed = client.get(f"/api/restaurant-images/{ids['restaurant']}/images").get_json()
        client.get(f"/api/restaurants/{ids['restaurant']}")
    finally:
        event.remove(db.engine, "before_cursor_execute", record)

    assert [image["id"] for image in listed] == sorted(image["id"] for image in listed)
    photo_queries = [s for s in statements if "restaurant_images.restaurant_id =" in s]
    assert len(photo_queries) >= 2, statements
    assert all("ORDER BY restaurant_images.id" in s for s in photo_queries), photo_queries


# --- 3. reseeding says nothing it shouldn't -----------------------------------------------

def test_reseeding_raises_no_identity_map_warnings(app):
    """
    The undo step deleted rows with raw SQL behind the session's back, and the
    reseed's rows met the session's stale objects under the same ids: 66
    "Identity map already had an identity" warnings in the test run.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("error", SAWarning)
        result = app.test_cli_runner().invoke(args=["seed", "all", "--reset"])

    assert result.exit_code == 0, result.output
    assert result.exception is None, result.exception
    assert Restaurant.query.count() == 10


# --- 4. a dropped database connection ------------------------------------------------------

def test_a_pooled_connection_is_pinged_before_it_is_used(app):
    """Neon drops idle connections; a dead one used to fail its first query."""
    assert app.config["SQLALCHEMY_ENGINE_OPTIONS"]["pool_pre_ping"] is True
    assert db.engine.pool._pre_ping is True
