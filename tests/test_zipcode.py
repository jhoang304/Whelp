"""
Zip codes are text, not integers: leading zeros survive and non-US postcodes
are accepted.
"""
import pytest

from app.models import Restaurant
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

    listed = client.get("/api/restaurants/").get_json()["Restaurants"]
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
    assert "zipcode" in res.get_json()["errors"]
