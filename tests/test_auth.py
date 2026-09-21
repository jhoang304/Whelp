"""
The auth routes: signing in, signing out, and the three signup rules that
reject a caller before a row is written.

The rest of the suite reaches these routes only through conftest's `login`,
which asserts success -- so every refusal path was untested.
"""
from app.models import Restaurant, User, db
from tests.conftest import login


def signup_body(**overrides):
    body = {
        "username": "newcomer",
        "email": "newcomer@test.io",
        "first_name": "New",
        "last_name": "Comer",
        "password": "password",
    }
    body.update(overrides)
    return body


def signup(client, **overrides):
    client.get("/api/auth/")  # hands the client its CSRF cookie
    return client.post("/api/auth/signup", json=signup_body(**overrides))


def test_logging_in_returns_the_user(client):
    body = login(client, "owner@test.io")
    assert body["username"] == "owner"
    assert body["email"] == "owner@test.io", "your own email is yours to see"


def test_a_wrong_password_is_refused(client):
    client.get("/api/auth/")
    res = client.post("/api/auth/login",
                      json={"email": "owner@test.io", "password": "not-the-password"})
    assert res.status_code == 401
    assert res.get_json()["errors"] == ["Invalid credentials"]


def test_an_unknown_email_is_refused_the_same_way(client):
    """
    Word for word the same as a wrong password: telling them apart tells an
    attacker which addresses have accounts.
    """
    client.get("/api/auth/")
    res = client.post("/api/auth/login",
                      json={"email": "nobody@test.io", "password": "password"})
    assert res.status_code == 401
    assert res.get_json()["errors"] == ["Invalid credentials"]


def test_a_refused_login_leaves_you_signed_out(client):
    client.get("/api/auth/")
    client.post("/api/auth/login", json={"email": "owner@test.io", "password": "wrong"})
    assert client.get("/api/auth/").status_code == 401


def test_logging_out_ends_the_session(client, ids):
    """
    Three test files call logout to switch users and none of them check it
    worked, which would have made a no-op logout look like a passing suite.
    """
    login(client, "owner@test.io")
    assert client.get("/api/auth/").status_code == 200

    res = client.get("/api/auth/logout")
    assert res.status_code == 200
    assert res.get_json() == {"message": "User logged out"}

    assert client.get("/api/auth/").status_code == 401
    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code in (302, 401)


def test_signup_creates_and_signs_in(client):
    res = signup(client)
    assert res.status_code == 200, res.get_json()
    assert res.get_json()["username"] == "newcomer"
    assert User.query.filter_by(username="newcomer").one()
    assert client.get("/api/auth/").status_code == 200, "signup signs you in"


def test_signup_refuses_a_taken_username(client):
    res = signup(client, username="owner", email="different@test.io")
    assert res.status_code == 400
    assert "Username is already in use." in res.get_json()["errors"]
    assert db.session.query(User).filter_by(email="different@test.io").first() is None


def test_signup_refuses_a_taken_email(client):
    res = signup(client, email="owner@test.io")
    assert res.status_code == 400
    assert "Email address is already in use." in res.get_json()["errors"]
    assert db.session.query(User).filter_by(username="newcomer").first() is None


def test_signup_refuses_an_address_that_is_not_one(client):
    res = signup(client, email="not-an-email")
    assert res.status_code == 400
    assert any("valid email" in message for message in res.get_json()["errors"])
    assert db.session.query(User).filter_by(username="newcomer").first() is None


def test_creating_a_restaurant_requires_login(client):
    """Edit and delete have this check; create never did."""
    res = client.post("/api/restaurants/", json={
        "name": "Uninvited", "price": "$", "address": "1 Main St", "city": "Houston",
        "state": "TX", "zipcode": "77001", "country": "USA",
        "phone_number": "(555) 555-5555", "website": "http://uninvited.com",
        "description": "Should never be written.",
    })
    assert res.status_code in (302, 401)
    assert db.session.query(Restaurant).filter_by(name="Uninvited").first() is None
