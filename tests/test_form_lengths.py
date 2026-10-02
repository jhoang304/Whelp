"""
Form validators must not accept more characters than the column can hold.

SQLite (dev and this suite) silently truncates nothing and accepts oversized
strings, but Postgres raises StringDataRightTruncation, which surfaces as an
unhandled 500. These tests pin each validator to its column.
"""
import pytest
import sqlalchemy as sa
from wtforms.validators import Length

from app.api.filters import PRICES
from app.forms import (
    RestaurantForm, RestaurantImageForm, ReviewForm, ReviewImageForm, SignUpForm)
from app.forms.review_form import MAX_REVIEW_LENGTH
from app.models import Restaurant, RestaurantImage, Review, ReviewImage, User
from tests.conftest import login


def max_length(form_class, field_name):
    """The Length(max=...) a form field enforces, or None if it has none."""
    field = getattr(form_class, field_name)
    for validator in field.kwargs.get("validators", []):
        if isinstance(validator, Length):
            return validator.max
    return None


def column_length(model, column_name):
    return model.__table__.columns[column_name].type.length


@pytest.mark.parametrize("form_class, field, model, column", [
    (RestaurantForm, "name", Restaurant, "name"),
    (RestaurantForm, "address", Restaurant, "address"),
    (RestaurantForm, "city", Restaurant, "city"),
    (RestaurantForm, "state", Restaurant, "state"),
    (RestaurantForm, "country", Restaurant, "country"),
    (RestaurantForm, "phone_number", Restaurant, "phone_number"),
    (RestaurantForm, "website", Restaurant, "website"),
    (RestaurantForm, "description", Restaurant, "description"),
    (SignUpForm, "username", User, "username"),
    (SignUpForm, "email", User, "email"),
    (SignUpForm, "first_name", User, "first_name"),
    (SignUpForm, "last_name", User, "last_name"),
    # Missed by #19: a long pasted photo URL was a 500 on Postgres (#111).
    (RestaurantImageForm, "url", RestaurantImage, "url"),
    (ReviewImageForm, "url", ReviewImage, "url"),
])
def test_validator_fits_in_its_column(form_class, field, model, column):
    limit = max_length(form_class, field)
    assert limit is not None, f"{form_class.__name__}.{field} has no Length validator"
    assert limit <= column_length(model, column), (
        f"{form_class.__name__}.{field} accepts {limit} characters but "
        f"{model.__name__}.{column} only holds {column_length(model, column)}")


def test_a_review_is_text_and_the_form_is_its_only_limit():
    """
    The column was String(255), about two sentences (#133). It is TEXT now,
    with no length of its own, and the form's 5,000 is the limit.
    """
    column = Review.__table__.columns["review"].type
    assert isinstance(column, sa.Text) and column.length is None
    assert max_length(ReviewForm, "review") == MAX_REVIEW_LENGTH == 5000


def test_every_price_the_form_takes_fits_its_column():
    """Price is one of a fixed set rather than a length (#111); each still has to fit."""
    assert max(len(price) for price in PRICES) <= column_length(Restaurant, "price")


def restaurant_payload(**overrides):
    body = {
        "name": "Length Test",
        "price": "$$",
        "address": "3 Long Rd",
        "city": "Houston",
        "state": "TX",
        "zipcode": "77002",
        "country": "USA",
        "phone_number": "(555) 000-0000",
        "website": "http://lengthtest.com",
        "description": "Checking field limits.",
    }
    body.update(overrides)
    return body


def test_oversized_city_is_rejected_not_500(client):
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=restaurant_payload(city="c" * 51))
    assert res.status_code == 400
    assert any("City" in message for message in res.get_json()["errors"])


def test_city_at_the_column_limit_is_accepted(client):
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=restaurant_payload(city="c" * 50))
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["city"] == "c" * 50


def test_address_up_to_the_column_limit_is_accepted(client):
    """The validator used to cap address at 50 even though the column holds 100."""
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=restaurant_payload(address="a" * 100))
    assert res.status_code == 200, res.get_json()


def test_long_country_name_fits(client):
    login(client, "owner@test.io")
    country = "The United Kingdom of Great Britain and Northern Ireland"  # 56 chars
    assert len(country) == 56
    res = client.post("/api/restaurants/", json=restaurant_payload(country=country))
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["country"] == country


def signup(client, username):
    client.get("/api/auth/")
    return client.post("/api/auth/signup", json={
        "username": username,
        "email": f"{username[:20]}@test.io",
        "first_name": "New",
        "last_name": "User",
        "password": "password",
    })


def test_oversized_username_is_rejected(client):
    res = signup(client, "u" * 41)
    assert res.status_code == 400  # a bad body, not an auth failure
    assert User.query.filter_by(username="u" * 41).first() is None


def test_username_at_the_column_limit_is_accepted(client):
    res = signup(client, "u" * 40)
    assert res.status_code == 200, res.get_json()


def test_oversized_review_is_rejected(client, ids):
    login(client, "bystander@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews",
                      json={"review": "r" * (MAX_REVIEW_LENGTH + 1), "rating": 5})
    assert res.status_code == 400
    assert Review.query.filter_by(user_id=ids["bystander"]).first() is None


def test_review_at_the_limit_is_accepted(client, ids):
    login(client, "bystander@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews",
                      json={"review": "r" * MAX_REVIEW_LENGTH, "rating": 5})
    assert res.status_code == 200, res.get_json()


# A real account of a meal: well past the old 255, with its paragraphs.
LONG_REVIEW = "\n\n".join([
    "We came for the omakase and stayed for three hours. " * 6,
    "The service was warm without hovering, and the sake list is long. " * 5,
    "Book ahead; the counter seats twelve. " * 4,
])


def test_a_long_review_is_posted_and_read_back_whole(client, ids):
    assert len(LONG_REVIEW) > 255
    login(client, "bystander@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews",
                      json={"review": LONG_REVIEW, "rating": 5})
    assert res.status_code == 200, res.get_json()

    read = client.get(f"/api/reviews/{res.get_json()['id']}").get_json()
    assert read["review"] == LONG_REVIEW


def test_a_review_is_edited_to_a_long_one_and_read_back_whole(client, ids):
    login(client, "reviewer@test.io")
    res = client.put(f"/api/reviews/{ids['review']}", json={"review": LONG_REVIEW, "rating": 4})
    assert res.status_code == 200, res.get_json()

    read = client.get(f"/api/reviews/{ids['review']}").get_json()
    assert read["review"] == LONG_REVIEW
