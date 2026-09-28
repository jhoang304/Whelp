"""
Input a caller got wrong is a 400 that says so, never a 500 (#111).

Each of these used to crash: a number or a list where text belongs, a body
that is not a JSON object, a photo URL longer than its column, a price the
column cannot hold, a page number that overflows the database's OFFSET.
The frontend never sends any of them, which is why they went unnoticed;
the API is still what answers.
"""
import inspect

import pytest
from wtforms import StringField

import app.forms
from app.forms.fields import TextField
from app.models import Restaurant, RestaurantImage, Review, User, db
from tests.conftest import login, visit
from tests.test_form_lengths import restaurant_payload


def refused(res, message=None):
    assert res.status_code == 400, (res.status_code, res.get_json())
    errors = res.get_json()["errors"]
    assert isinstance(errors, list) and errors
    if message is not None:
        assert message in errors, errors


# --- the wrong type where text belongs ----------------------------------------

@pytest.mark.parametrize("value", [123, True, {"a": 1}, ["one", "two"]])
def test_a_review_that_is_not_text(client, ids, value):
    login(client, "bystander@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews", json={"review": value, "rating": 4})
    refused(res, "review must be text.")
    assert Review.query.count() == 1


@pytest.mark.parametrize("field, value", [
    ("name", ["Valid", "x"]), ("description", True), ("city", 5), ("website", {"a": 1}),
])
def test_a_restaurant_field_that_is_not_text(client, field, value):
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=restaurant_payload(**{field: value}))
    refused(res, f"{field} must be text.")
    assert Restaurant.query.count() == 1


def test_editing_a_restaurant_with_a_list_changes_nothing(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=restaurant_payload(name=["New", "x"]))
    refused(res, "name must be text.")
    assert db.session.get(Restaurant, ids["restaurant"]).name == "Test Bistro"


def test_a_zipcode_may_still_be_a_number(client):
    """The one field that takes a number on purpose: it used to be an integer column (#20)."""
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=restaurant_payload(zipcode=77002))
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["zipcode"] == "77002"


def test_logging_in_with_a_number_is_refused_not_crashed(client):
    visit(client)
    res = client.post("/api/auth/login", json={"email": "owner@test.io", "password": 12345678})
    assert res.status_code == 401
    res = client.post("/api/auth/login", json={"email": 5, "password": "password"})
    assert res.status_code == 401


def test_signing_up_with_a_number_is_refused(client):
    visit(client)
    res = client.post("/api/auth/signup", json={
        "username": "newbie", "email": 5, "first_name": "New", "last_name": "Bie", "password": "password"})
    refused(res, "email must be text.")
    assert User.query.filter_by(username="newbie").first() is None


def test_account_and_profile_fields_that_are_not_text(client, ids):
    login(client, "owner@test.io")
    refused(client.put(f"/api/users/{ids['owner']}/edit", json={"username": 123}), "username must be text.")
    refused(client.put(f"/api/users/{ids['owner']}/edit", json={"username": "owner", "profile_image_url": 5}),
            "profile_image_url must be text.")
    refused(client.put(f"/api/users/{ids['owner']}/password",
                       json={"current_password": 12345678, "new_password": "a-new-password"}),
            "current_password must be text.")


def test_clearing_the_profile_picture_with_null_still_works(client, ids):
    """A null is how the profile editor clears the picture: absent, not the wrong type."""
    login(client, "owner@test.io")
    res = client.put(f"/api/users/{ids['owner']}/edit", json={"username": "owner", "profile_image_url": None})
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["profile_image_url"] is None


def test_an_owner_reply_that_is_not_text(client, ids):
    login(client, "owner@test.io")
    refused(client.post(f"/api/reviews/{ids['review']}/response", json={"response": 123}),
            "response must be text.")


def test_a_photo_url_that_is_not_text(client, ids):
    login(client, "owner@test.io")
    refused(client.post(f"/api/restaurants/{ids['restaurant']}/images", json={"url": 5}), "url must be text.")
    assert RestaurantImage.query.count() == 1


# --- ratings --------------------------------------------------------------------

@pytest.mark.parametrize("rating", [True, 4.7, [4, 5]])
def test_a_rating_that_is_not_a_whole_number(client, ids, rating):
    """true used to become a 1-star review, and 4.7 a 4."""
    login(client, "bystander@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews", json={"review": "Fine.", "rating": rating})
    refused(res, "rating must be a whole number.")


@pytest.mark.parametrize("rating, stored", [("5", 5), (4.0, 4)])
def test_a_whole_number_however_it_is_written(client, ids, rating, stored):
    login(client, "bystander@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews", json={"review": "Fine.", "rating": rating})
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["rating"] == stored


# --- bodies that are not objects ------------------------------------------------

@pytest.mark.parametrize("body", [b"[1, 2]", b'"just a string"', b"42", b"null", b"true"])
def test_a_body_that_is_not_an_object(client, ids, body):
    login(client, "bystander@test.io")
    for path in (f"/api/restaurants/{ids['restaurant']}/reviews", "/api/restaurants/", "/api/auth/login"):
        res = client.post(path, data=body, content_type="application/json")
        refused(res, "The request body must be a JSON object.")


def test_a_body_that_is_not_json_is_still_a_plain_400(client, ids):
    login(client, "bystander@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews",
                      data=b"{not json", content_type="application/json")
    assert res.status_code == 400


def test_an_empty_json_body_is_left_to_the_route(client, ids):
    """A DELETE with a JSON content type and nothing in it is not malformed."""
    login(client, "owner@test.io")
    res = client.delete(f"/api/restaurants/{ids['restaurant']}/favorite", content_type="application/json")
    assert res.status_code == 200


# --- lengths and values the columns cannot hold ---------------------------------

def test_a_photo_url_longer_than_its_column(client, ids):
    login(client, "owner@test.io")
    long_url = "https://cdn.example.com/" + "a" * 300 + ".jpg"
    refused(client.post(f"/api/restaurants/{ids['restaurant']}/images", json={"url": long_url}),
            "Image URL must be 255 characters or fewer.")
    login(client, "reviewer@test.io")
    refused(client.post(f"/api/reviews/{ids['review']}/images", json={"url": long_url}),
            "Image URL must be 255 characters or fewer.")


def test_a_photo_url_must_be_a_web_address(client, ids):
    login(client, "owner@test.io")
    for url in ("javascript:alert(1)", "ftp://example.com/a.jpg", "not a url"):
        refused(client.post(f"/api/restaurants/{ids['restaurant']}/images", json={"url": url}),
                "Image URL must start with http:// or https://.")
    # As the client's own check (/^https?:\/\/.+/i) does: the scheme in any case.
    res = client.post(f"/api/restaurants/{ids['restaurant']}/images", json={"url": "HTTPS://Example.com/a.jpg"})
    assert res.status_code == 200, res.get_json()


@pytest.mark.parametrize("price", ["cheap", "$$$$$$$$", "$ $"])
def test_a_price_that_is_not_one_of_the_five(client, price):
    """'cheap' saved and could never be filtered to; eight dollar signs overflowed the column."""
    login(client, "owner@test.io")
    refused(client.post("/api/restaurants/", json=restaurant_payload(price=price)),
            "Price must be one of $, $$, $$$, $$$$, $$$$$.")


# --- pages ----------------------------------------------------------------------

@pytest.mark.parametrize("path", ["/api/restaurants/", "/api/restaurants/search?q=bistro",
                                  "/api/restaurants/{restaurant}/reviews"])
def test_a_page_past_any_list_is_refused(client, ids, path):
    """(page - 1) * per_page overflowed the database's 64-bit OFFSET."""
    url = path.format(**ids)
    joiner = "&" if "?" in url else "?"
    for page in ("10001", "9223372036854775807", "99999999999999999999"):
        refused(client.get(f"{url}{joiner}page={page}"), "page must be 10000 or less")
    res = client.get(f"{url}{joiner}page=10000")
    assert res.status_code == 200
    assert res.get_json()["items"] == []


# --- keeping it that way ---------------------------------------------------------

def form_classes():
    return [cls for _, cls in inspect.getmembers(app.forms, inspect.isclass)
            if cls.__module__.startswith("app.forms")]


def test_every_text_field_refuses_the_wrong_type():
    """A plain StringField would take a number again. Zipcode converts one on purpose."""
    plain = []
    for form in form_classes():
        for name, field in vars(form).items():
            unbound = getattr(field, "field_class", None)
            if unbound and issubclass(unbound, StringField) and not issubclass(unbound, TextField):
                plain.append(f"{form.__name__}.{name}")
    assert plain == ["RestaurantForm.zipcode"]
