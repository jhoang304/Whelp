from tests.conftest import login


def respond(client, review_id, text="Thanks for visiting!"):
    return client.post(f"/api/reviews/{review_id}/response", json={"response": text})


def test_owner_can_respond_once(client, ids):
    login(client, "owner@test.io")
    res = respond(client, ids["review"])
    assert res.status_code == 201, res.get_json()
    data = res.get_json()
    assert data["response"] == "Thanks for visiting!"
    assert data["review_id"] == ids["review"]
    assert data["user"]["username"] == "owner"

    dup = respond(client, ids["review"], "Again")
    assert dup.status_code == 400


def test_non_owner_cannot_respond(client, ids):
    login(client, "reviewer@test.io")
    assert respond(client, ids["review"]).status_code == 403
    client.get("/api/auth/logout")
    login(client, "bystander@test.io")
    assert respond(client, ids["review"]).status_code == 403


def test_response_requires_login_and_existing_review(client, ids):
    assert respond(client, ids["review"]).status_code in (302, 401)  # redirect to /api/auth/unauthorized
    login(client, "owner@test.io")
    assert respond(client, 9999).status_code == 404


def test_response_validation(client, ids):
    login(client, "owner@test.io")
    res = respond(client, ids["review"], "")
    assert res.status_code == 400
    assert any("required" in e.lower() for e in res.get_json()["errors"])
    res = respond(client, ids["review"], "x" * 1001)
    assert res.status_code == 400


def test_owner_can_edit_and_delete_response(client, ids):
    login(client, "owner@test.io")
    respond(client, ids["review"])

    res = client.put(f"/api/reviews/{ids['review']}/response", json={"response": "Updated reply"})
    assert res.status_code == 200
    assert res.get_json()["response"] == "Updated reply"

    res = client.delete(f"/api/reviews/{ids['review']}/response")
    assert res.status_code == 200
    assert client.put(f"/api/reviews/{ids['review']}/response", json={"response": "x"}).status_code == 404
    assert client.delete(f"/api/reviews/{ids['review']}/response").status_code == 404


def test_reviews_payloads_include_response(client, ids):
    login(client, "owner@test.io")
    respond(client, ids["review"], "We appreciate it")

    by_restaurant = client.get(f"/api/restaurants/{ids['restaurant']}/reviews").get_json()["items"]
    assert by_restaurant[0]["response"]["response"] == "We appreciate it"
    assert by_restaurant[0]["user"]["username"] == "reviewer"
    assert "email" not in by_restaurant[0]["user"]

    by_user = client.get(f"/api/reviews/{ids['reviewer']}").get_json()
    assert by_user[0]["response"]["response"] == "We appreciate it"
    assert by_user[0]["restaurant"]["name"] == "Test Bistro"
    assert by_user[0]["restaurant"]["previewImage"] == "https://example.com/a.jpg"


def test_deleting_review_removes_response(client, ids):
    login(client, "owner@test.io")
    respond(client, ids["review"])
    client.get("/api/auth/logout")

    login(client, "reviewer@test.io")
    assert client.delete(f"/api/reviews/{ids['review']}").status_code == 200

    from app.models import ReviewResponse
    assert ReviewResponse.query.count() == 0


def test_only_author_can_edit_or_delete_review(client, ids):
    login(client, "bystander@test.io")
    assert client.put(f"/api/reviews/{ids['review']}", json={"review": "hijack", "rating": 1}).status_code == 403
    assert client.delete(f"/api/reviews/{ids['review']}").status_code == 403
