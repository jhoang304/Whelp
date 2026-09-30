"""
How the API says "you're not signed in" (#126).

With a login_view, Flask-Login answered a signed-out request to a protected
route with a 302 to an HTML "Redirecting..." page. A browser follows that with
the same method, and the page was GET-only, so a stale tab's PUT or DELETE
ended in a 405. It also flashed "Please log in" into the session cookie on
every refusal, for an API that never shows one.
"""
import pytest

from tests.conftest import login, visit


def signed_out_requests(ids):
    return [
        ("GET", "/api/users/"),
        ("GET", f"/api/users/{ids['bystander']}/favorites"),
        ("POST", f"/api/restaurants/{ids['restaurant']}/favorite"),
        ("PUT", f"/api/restaurants/{ids['restaurant']}"),
        ("DELETE", f"/api/restaurants/{ids['restaurant']}"),
        ("PUT", f"/api/reviews/{ids['review']}"),
        ("DELETE", f"/api/reviews/{ids['review']}"),
    ]


@pytest.mark.parametrize("index", range(7))
def test_a_signed_out_request_is_a_401_in_the_errors_shape(client, ids, index):
    method, url = signed_out_requests(ids)[index]
    visit(client)

    res = client.open(url, method=method, json={})

    assert res.status_code == 401, (method, url, res.status_code)
    assert res.get_json() == {"errors": ["Unauthorized"]}
    assert "Location" not in res.headers, "no redirect to follow"


def test_a_refusal_leaves_nothing_in_the_session(client, ids):
    visit(client)
    for _ in range(3):
        client.delete(f"/api/restaurants/{ids['restaurant']}")

    with client.session_transaction() as session:
        assert "_flashes" not in session


def test_the_page_it_used_to_redirect_to_is_gone(client):
    assert client.get("/api/auth/unauthorized").status_code == 404


def test_flashes_left_from_before_are_dropped(client):
    """Refused before this fix, a visitor's cookie still carries the pile."""
    visit(client)
    with client.session_transaction() as session:
        session["_flashes"] = [("message", "Please log in to access this page.")] * 5

    client.get("/api/restaurants/")

    with client.session_transaction() as session:
        assert "_flashes" not in session


def test_nobody_signed_in_is_an_answer_not_an_error(client):
    res = client.get("/api/auth/")

    assert res.status_code == 200
    assert res.get_json() == {"user": None}


def test_somebody_signed_in_is_still_their_user(client):
    login(client, "owner@test.io")

    res = client.get("/api/auth/")

    assert res.status_code == 200
    assert res.get_json()["username"] == "owner"
