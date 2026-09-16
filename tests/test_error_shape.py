"""
One error shape for the whole API: {"errors": [message, ...]}, a flat list of
strings, whatever the endpoint and whatever went wrong.
"""
import pytest
from werkzeug.exceptions import NotFound

from tests.conftest import login


def restaurant_body(**overrides):
    body = {
        "name": "Shape Test", "price": "$$", "address": "1 Main St", "city": "Houston",
        "state": "TX", "zipcode": "77001", "country": "USA", "phone_number": "(555) 555-5555",
        "website": "http://shapetest.com", "description": "A place for tests.",
    }
    body.update(overrides)
    return body


def rejected_signup(client, ids):
    client.get("/api/auth/")
    return client.post("/api/auth/signup", json={
        "username": "u" * 41, "email": "shape@test.io",
        "first_name": "Shape", "last_name": "Test", "password": "password"})


def rejected_create_restaurant(client, ids):
    login(client, "owner@test.io")
    return client.post("/api/restaurants/", json=restaurant_body(name=""))


def rejected_edit_restaurant(client, ids):
    login(client, "owner@test.io")
    return client.put(f"/api/restaurants/{ids['restaurant']}", json=restaurant_body(city=""))


def rejected_create_review(client, ids):
    login(client, "bystander@test.io")
    return client.post(f"/api/restaurants/{ids['restaurant']}/reviews",
                       json={"review": "", "rating": 9})


def rejected_review_response(client, ids):
    login(client, "owner@test.io")
    return client.post(f"/api/reviews/{ids['review']}/response", json={"response": ""})


def rejected_profile_edit(client, ids):
    login(client, "owner@test.io")
    return client.put(f"/api/users/{ids['owner']}/edit", json={"username": ""})


def unknown_restaurant(client, ids):
    return client.get("/api/restaurants/9999")


def forbidden_edit(client, ids):
    login(client, "bystander@test.io")
    return client.put(f"/api/restaurants/{ids['restaurant']}", json=restaurant_body())


def signed_out_delete(client, ids):
    return client.delete(f"/api/restaurants/{ids['restaurant']}")


def blank_search(client, ids):
    return client.get("/api/restaurants/search/%20")


def unknown_api_path(client, ids):
    return client.get("/api/not-a-real-endpoint")


@pytest.mark.parametrize("make_request", [
    rejected_signup,
    rejected_create_restaurant,
    rejected_edit_restaurant,
    rejected_create_review,
    rejected_review_response,
    rejected_profile_edit,
    unknown_restaurant,
    forbidden_edit,
    blank_search,
    unknown_api_path,
], ids=lambda f: f.__name__)
def test_every_failure_is_a_flat_list_of_messages(client, ids, make_request):
    res = make_request(client, ids)
    assert 400 <= res.status_code < 500, res.get_data(as_text=True)

    errors = res.get_json()["errors"]
    assert isinstance(errors, list), errors
    assert errors, "a rejected request must say why"
    assert all(isinstance(message, str) and message.strip() for message in errors), errors


def test_signed_out_requests_keep_the_shape(client, ids):
    """flask-login can answer these itself, so they are worth their own check."""
    res = signed_out_delete(client, ids)
    if res.status_code == 401:
        assert res.get_json()["errors"] == ["Unauthorized"]


def test_validation_messages_name_their_own_field(client, ids):
    """
    A flat list drops the field names WTForms keyed its dict by, so each
    message has to carry its own -- "Field must be between 1 and 40
    characters long" tells the reader of a signup form nothing.
    """
    res = rejected_signup(client, ids)
    assert any("Username" in message for message in res.get_json()["errors"]), res.get_json()

    res = rejected_create_restaurant(client, ids)
    assert any("Restaurant name" in message for message in res.get_json()["errors"]), res.get_json()


def test_the_session_probe_answers_401_when_nobody_is_signed_in(client):
    """It used to answer 200 with an errors body, which says both at once."""
    res = client.get("/api/auth/")
    assert res.status_code == 401
    assert res.get_json()["errors"] == ["Unauthorized"]


def test_the_session_probe_still_returns_the_signed_in_user(client):
    login(client, "owner@test.io")
    res = client.get("/api/auth/")
    assert res.status_code == 200
    assert res.get_json()["username"] == "owner"


def test_the_shape_is_documented(client):
    res = client.get("/api/docs")
    assert res.status_code == 200
    assert '{"errors": [message, ...]}' in res.get_json()["errors"]
    assert "/api/restaurants/" in res.get_json()["routes"]


def test_werkzeug_own_failures_are_converted(client, ids):
    """
    A method no rule takes never reaches a route: Werkzeug raises 405 and
    would answer with an HTML page. The Allow header it built has to survive
    the conversion, since that is the useful half of the answer.
    """
    login(client, "owner@test.io")
    res = client.open(f"/api/restaurants/{ids['restaurant']}", method="PATCH")
    assert res.status_code == 405
    assert res.mimetype == "application/json"
    assert res.get_json()["errors"] and isinstance(res.get_json()["errors"], list)
    assert "PUT" in res.headers["Allow"]


def test_a_bug_in_a_route_is_still_the_documented_shape(client, app, monkeypatch):
    """
    Tests and dev re-raise so the traceback is not swallowed; in production the
    caller gets JSON rather than Flask's HTML 500 page.
    """
    monkeypatch.setitem(app.config, "TESTING", False)
    monkeypatch.setitem(app.config, "PROPAGATE_EXCEPTIONS", False)

    class Boom:
        class query:
            @staticmethod
            def all():
                raise RuntimeError("boom")

    monkeypatch.setattr("app.api.restaurant_routes.Restaurant", Boom)

    res = client.get("/api/restaurants/")
    assert res.status_code == 500
    assert res.get_json() == {"errors": ["Something went wrong on our end."]}


def test_a_page_url_does_not_get_json_errors(client, app, monkeypatch):
    """The conversion is for API callers; a browser still gets the SPA."""
    def only_index(filename):
        if filename != "index.html":
            raise NotFound()
        return "stub:index.html"

    monkeypatch.setattr(app, "send_static_file", only_index)

    res = client.get("/some/client/route")
    assert res.status_code == 200
    assert res.get_data(as_text=True) == "stub:index.html"
