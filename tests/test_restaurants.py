from app.models import Restaurant
from tests.conftest import login


def payload(**overrides):
    """A body that passes RestaurantForm; override single fields per test."""
    body = {
        "name": "Renamed Bistro",
        "price": "$$",
        "address": "2 Side St",
        "city": "Austin",
        "state": "TX",
        "zipcode": 78701,
        "country": "USA",
        "phone_number": "(555) 111-2222",
        "website": "http://renamed.com",
        "description": "Now under new management.",
    }
    body.update(overrides)
    return body


def test_edit_and_delete_require_login(client, ids):
    assert client.put(f"/api/restaurants/{ids['restaurant']}",
                      json=payload()).status_code in (302, 401)
    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code in (302, 401)


def test_non_owner_cannot_edit_restaurant(client, ids):
    login(client, "bystander@test.io")
    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload())
    assert res.status_code == 403
    assert Restaurant.query.get(ids["restaurant"]).name == "Test Bistro"


def test_non_owner_cannot_delete_restaurant(client, ids):
    login(client, "bystander@test.io")
    res = client.delete(f"/api/restaurants/{ids['restaurant']}")
    assert res.status_code == 403
    assert Restaurant.query.get(ids["restaurant"]) is not None


def test_owner_can_edit_restaurant(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload())
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["name"] == "Renamed Bistro"
    assert Restaurant.query.get(ids["restaurant"]).city == "Austin"


def test_edit_does_not_transfer_ownership(client, ids):
    """A successful edit must leave user_id alone, not reassign it to the caller."""
    login(client, "owner@test.io")
    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload())
    assert res.status_code == 200
    assert res.get_json()["user_id"] == ids["owner"]
    assert Restaurant.query.get(ids["restaurant"]).user_id == ids["owner"]


def test_owner_can_delete_restaurant(client, ids):
    login(client, "owner@test.io")
    res = client.delete(f"/api/restaurants/{ids['restaurant']}")
    assert res.status_code == 200, res.get_json()
    assert Restaurant.query.get(ids["restaurant"]) is None


def test_edit_and_delete_missing_restaurant_is_404(client):
    login(client, "owner@test.io")
    assert client.put("/api/restaurants/9999", json=payload()).status_code == 404
    assert client.delete("/api/restaurants/9999").status_code == 404
