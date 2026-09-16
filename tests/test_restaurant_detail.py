def test_existing_restaurant_returns_detail(client, ids):
    res = client.get(f"/api/restaurants/{ids['restaurant']}")
    assert res.status_code == 200
    data = res.get_json()
    assert data["name"] == "Test Bistro"
    assert data["User"]["firstName"] == "Olive"
    assert data["numReviews"] == 1
    assert data["avgStarRating"] == 4
    assert data["restaurantImages"][0]["url"] == "https://example.com/a.jpg"


def test_unknown_restaurant_is_404(client):
    res = client.get("/api/restaurants/9999")
    assert res.status_code == 404
    assert res.get_json()["errors"] == ["Restaurant couldn't be found"]


def test_detail_does_not_print_to_stdout(client, ids, capsys):
    """A leftover `print("!!!!", ...)` used to run on every request."""
    client.get(f"/api/restaurants/{ids['restaurant']}")
    assert "!!!!" not in capsys.readouterr().out
