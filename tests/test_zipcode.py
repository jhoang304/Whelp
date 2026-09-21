"""
Zip codes are text, not integers: leading zeros survive and non-US postcodes
are accepted.
"""
import pytest

from app.models import Restaurant, db
from tests.conftest import login


def payload(zipcode, name="Zip Test"):
    return {
        "name": name,
        "price": "$$",
        "address": "4 Post Rd",
        "city": "Boston",
        "state": "MA",
        "zipcode": zipcode,
        "country": "USA",
        "phone_number": "(555) 222-3333",
        "website": "http://ziptest.com",
        "description": "Checking postcodes.",
    }


def test_zipcode_column_is_text():
    assert Restaurant.__table__.columns["zipcode"].type.length == 10


@pytest.mark.parametrize("zipcode", [
    "02134",        # Boston: the leading zero used to be dropped
    "77003-1234",   # ZIP+4
    "M5V 3L9",      # Canadian
    "SW1A 1AA",     # UK
])
def test_accepts_and_preserves_postcodes(client, zipcode):
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=payload(zipcode))
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["zipcode"] == zipcode
    assert Restaurant.query.filter_by(name="Zip Test").one().zipcode == zipcode


def test_leading_zero_survives_the_detail_and_list_endpoints(client):
    login(client, "owner@test.io")
    created = client.post("/api/restaurants/", json=payload("02134")).get_json()

    detail = client.get(f"/api/restaurants/{created['id']}").get_json()
    assert detail["zipcode"] == "02134"

    listed = client.get("/api/restaurants/").get_json()["items"]
    assert next(r for r in listed if r["id"] == created["id"])["zipcode"] == "02134"


def test_editing_keeps_the_postcode_as_text(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload("02134", name="Test Bistro"))
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["zipcode"] == "02134"


@pytest.mark.parametrize("zipcode", ["", "12", "x" * 11])
def test_rejects_postcodes_outside_3_to_10_characters(client, zipcode):
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=payload(zipcode))
    assert res.status_code == 400
    assert any("Postal code" in message for message in res.get_json()["errors"])


@pytest.mark.parametrize("zipcode", [
    "!!!",          # punctuation only
    "770@31234",    # stray symbol
    "A--B",         # repeated separator
    "A- B",         # mixed separators in a row
    "-2134",        # leading separator
    "02134-",       # trailing separator
    " 02134",       # untrimmed
])
def test_rejects_malformed_postcodes(client, zipcode):
    """Length alone is not a postcode; the shape is enforced server-side too."""
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=payload(zipcode))
    assert res.status_code == 400
    assert any("Postal code" in message for message in res.get_json()["errors"])
    assert Restaurant.query.filter_by(name="Zip Test").first() is None


def test_accepts_a_numeric_postcode_from_older_callers(client):
    """
    The column used to be an integer and the API took a JSON number, so
    `"zipcode": 77003` must still work rather than blowing up Length() with
    len(int) - which surfaced as a 500, not a 400.
    """
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=payload(77003))
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["zipcode"] == "77003"
    assert Restaurant.query.filter_by(name="Zip Test").one().zipcode == "77003"


@pytest.mark.parametrize("zipcode", [77003.5, {"a": 1}, None, True, False])
def test_rejects_non_postcode_json_types_with_400(client, zipcode):
    """
    Coercing to text must not let nonsense through as a stored value. `true`
    is the sharp case: str(True) is "True", which is 3-10 characters and
    matches the postcode pattern, so it would have been stored as a real
    postcode had the filter stringified everything.
    """
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=payload(zipcode))
    assert res.status_code == 400, res.get_json()
    assert Restaurant.query.filter_by(name="Zip Test").first() is None


def test_list_valued_postcode_is_taken_as_its_first_entry(client):
    """
    A JSON list is standard multi-valued form data, so the form reads its
    first entry. What matters is that it no longer reaches SQLAlchemy raw:
    persisting the unvalidated JSON made this a 500.
    """
    login(client, "owner@test.io")
    res = client.post("/api/restaurants/", json=payload(["77003"]))
    assert res.status_code == 200, res.get_json()
    assert Restaurant.query.filter_by(name="Zip Test").one().zipcode == "77003"


def test_editing_rejects_a_malformed_postcode(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload("!!!", name="Test Bistro"))
    assert res.status_code == 400
    assert db.session.get(Restaurant, ids["restaurant"]).zipcode == "77001"


def test_server_and_client_postcode_rules_are_the_same():
    """
    app/forms/postcode.py and react-app/src/utils/postcode.ts must agree;
    a client looser than the server is how issue #19 happened.
    """
    import pathlib
    import re

    from app.forms.postcode import POSTCODE_MAX, POSTCODE_MIN, POSTCODE_REGEX

    source = (pathlib.Path(__file__).resolve().parents[1]
              / "react-app" / "src" / "utils" / "postcode.ts").read_text(encoding="utf-8")

    pattern = re.search(r"POSTCODE_PATTERN = /(.+)/;", source).group(1)
    assert pattern == POSTCODE_REGEX
    assert re.search(r"POSTCODE_MIN = (\d+);", source).group(1) == str(POSTCODE_MIN)
    assert re.search(r"POSTCODE_MAX = (\d+);", source).group(1) == str(POSTCODE_MAX)
