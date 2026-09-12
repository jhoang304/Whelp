from tests.conftest import login


def test_public_profile_includes_businesses_and_counts(client, ids):
    res = client.get(f"/api/users/get/{ids['owner']}")
    assert res.status_code == 200
    data = res.get_json()
    assert data["username"] == "owner"
    assert data["restaurant_count"] == 1
    assert data["review_count"] == 0
    assert data["restaurants"][0]["name"] == "Test Bistro"
    assert data["restaurants"][0]["previewImage"] == "https://example.com/a.jpg"
    assert data["restaurants"][0]["avgRating"] == 4
    assert "email" not in data, "email must not leak to other viewers"
    assert "profile_image_url" in data


def test_own_profile_includes_email(client, ids):
    login(client, "owner@test.io")
    data = client.get(f"/api/users/get/{ids['owner']}").get_json()
    assert data["email"] == "owner@test.io"


def test_missing_profile_is_404(client):
    assert client.get("/api/users/get/9999").status_code == 404


def test_edit_profile_requires_login(client, ids):
    res = client.put(f"/api/users/{ids['owner']}/edit", json={"username": "x"})
    assert res.status_code in (302, 401)  # Flask-Login redirects to /api/auth/unauthorized


def test_cannot_edit_someone_elses_profile(client, ids):
    login(client, "bystander@test.io")
    res = client.put(f"/api/users/{ids['owner']}/edit", json={"username": "hijacked"})
    assert res.status_code == 403
    assert client.get(f"/api/users/get/{ids['owner']}").get_json()["username"] == "owner"


def test_edit_own_profile_updates_fields(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/users/{ids['owner']}/edit", json={
        "username": "olive_o",
        "first_name": "Olivia",
        "last_name": "Ownerson",
        "profile_image_url": "https://example.com/me.png",
    })
    assert res.status_code == 200, res.get_json()
    data = res.get_json()
    assert data["username"] == "olive_o"
    assert data["first_name"] == "Olivia"
    assert data["last_name"] == "Ownerson"
    assert data["profile_image_url"] == "https://example.com/me.png"

    # the session user reflects the change too
    assert client.get("/api/auth/").get_json()["username"] == "olive_o"


def test_edit_profile_can_clear_picture_and_keeps_name_when_blank(client, ids):
    login(client, "owner@test.io")
    client.put(f"/api/users/{ids['owner']}/edit",
               json={"username": "owner", "profile_image_url": "https://example.com/me.png"})
    res = client.put(f"/api/users/{ids['owner']}/edit",
                     json={"username": "owner", "first_name": "", "profile_image_url": ""})
    assert res.status_code == 200
    assert res.get_json()["profile_image_url"] is None
    assert res.get_json()["first_name"] == "Olive"


def test_edit_profile_rejects_taken_username(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/users/{ids['owner']}/edit", json={"username": "reviewer"})
    assert res.status_code == 400
    assert "Username is already in use." in res.get_json()["errors"]


def test_edit_profile_rejects_blank_username(client, ids):
    login(client, "owner@test.io")
    res = client.put(f"/api/users/{ids['owner']}/edit", json={"username": ""})
    assert res.status_code == 400
