"""
What a phone number may contain.

The rule before this was "the server imposes no format at all", which is how
`(346) 571-7931asdf` saved cleanly. The rule before *that* was an allowlist of
digits, spaces, hyphens and parentheses, which rejected `+1 555 123 4567` for
want of a plus -- so the formats below are the point of the test, not the
rejections.
"""
import pytest

from app.forms.phone import PHONE_MESSAGE, is_valid_phone, strip_extension
from tests.conftest import login


@pytest.mark.parametrize("number", [
    "(555) 555-5555",
    "+1 555 123 4567",
    "+44 20 7123 4567",
    "555.123.4567",
    "555-1234 x99",
    "(555) 555-5555 ext. 12",
    "555 1234,x5",
    "5551234",
    "+1 (555) 555-5555/6",
])
def test_a_number_someone_might_really_have(number):
    assert is_valid_phone(number), number


@pytest.mark.parametrize("number", [
    "(346) 571-7931asdf",   # the one that started this
    "call me",
    "555-CALL-NOW",         # a vanity number: rejected on purpose
    "1-800-FLOWERS",
    "5551234 please",
])
def test_a_number_carrying_letters_is_refused(number):
    assert not is_valid_phone(number), number


def test_an_extension_is_taken_off_before_the_check():
    assert strip_extension("555-1234 x99") == "555-1234"
    assert strip_extension("(555) 555-5555 ext. 12") == "(555) 555-5555"
    assert strip_extension("+1 555 123 4567") == "+1 555 123 4567"


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


def test_the_api_refuses_a_phone_number_with_letters_in_it(client, ids):
    """The client checks first, but the client is not the authority."""
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}",
                     json=payload(phone_number="(346) 571-7931asdf"))

    assert res.status_code == 400
    assert PHONE_MESSAGE in res.get_json()["errors"]


def test_the_api_still_takes_an_international_number(client, ids):
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}",
                     json=payload(phone_number="+44 20 7123 4567"))

    assert res.status_code == 200, res.get_json()


def test_creating_with_a_bad_number_writes_nothing(client, ids):
    from app.models import Restaurant

    login(client, "owner@test.io")
    before = Restaurant.query.count()

    res = client.post("/api/restaurants/", json=payload(
        name="Junk Diner", phone_number="(555) 555-5555abc"))

    assert res.status_code == 400
    assert Restaurant.query.count() == before
