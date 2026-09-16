from tests.conftest import login


def test_user_list_requires_login(client):
    assert client.get("/api/users/").status_code in (302, 401)


def test_user_detail_requires_login(client, ids):
    assert client.get(f"/api/users/{ids['owner']}").status_code in (302, 401)


def test_user_list_does_not_leak_emails(client):
    login(client, "bystander@test.io")
    res = client.get("/api/users/")
    assert res.status_code == 200
    users = res.get_json()["users"]
    assert len(users) == 3
    assert all("email" not in user for user in users), "email must not leak in the user list"
    assert {user["username"] for user in users} == {"owner", "reviewer", "bystander"}


def test_user_detail_does_not_leak_email(client, ids):
    login(client, "bystander@test.io")
    res = client.get(f"/api/users/{ids['owner']}")
    assert res.status_code == 200
    data = res.get_json()
    assert "email" not in data, "email must not leak to other viewers"
    assert data["username"] == "owner"


def test_user_detail_hides_email_even_from_yourself(client, ids):
    """Your own email comes from GET /api/auth/, not from this route."""
    login(client, "owner@test.io")
    data = client.get(f"/api/users/{ids['owner']}").get_json()
    assert "email" not in data
    assert client.get("/api/auth/").get_json()["email"] == "owner@test.io"


def test_missing_user_is_404(client):
    login(client, "owner@test.io")
    assert client.get("/api/users/9999").status_code == 404
