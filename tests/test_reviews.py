"""
Review create/edit failures must come back in the same shape as every other
route: {"errors": [...]}, carrying the real WTForms messages. The UI reads that
list to tell the user why a review was rejected (see issue #21).
"""
from app.models import Review, db
from tests.conftest import login


def test_create_review_validation_errors_are_a_list_of_messages(client, ids):
    login(client, "bystander@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews",
                      json={"review": "", "rating": 4})
    assert res.status_code == 400
    errors = res.get_json()["errors"]
    assert isinstance(errors, list) and errors
    assert all(isinstance(message, str) for message in errors)
    assert Review.query.filter_by(user_id=ids["bystander"]).first() is None


def test_create_review_reports_the_real_rating_message(client, ids):
    login(client, "bystander@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews",
                      json={"review": "Great.", "rating": 9})
    assert res.status_code == 400
    errors = res.get_json()["errors"]
    assert isinstance(errors, list)
    assert any("between 1 and 5" in message for message in errors), errors


def test_duplicate_review_is_403_with_a_list(client, ids):
    login(client, "reviewer@test.io")  # already reviewed in the fixtures
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews",
                      json={"review": "Second try.", "rating": 5})
    assert res.status_code == 403
    assert res.get_json()["errors"] == ["User already has a review for this restaurant"]


def test_owner_cannot_review_their_own_restaurant(client, ids):
    login(client, "owner@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews",
                      json={"review": "Best place in town.", "rating": 5})
    assert res.status_code == 403
    assert isinstance(res.get_json()["errors"], list)


def test_edit_review_validation_errors_are_a_list_of_messages(client, ids):
    login(client, "reviewer@test.io")
    res = client.put(f"/api/reviews/{ids['review']}", json={"review": "r" * 256, "rating": 4})
    assert res.status_code == 400
    errors = res.get_json()["errors"]
    assert isinstance(errors, list) and errors
    assert all(isinstance(message, str) for message in errors)
    # the copy-pasted "stars" key from another project is gone
    assert db.session.get(Review, ids["review"]).review == "Solid."


def test_edit_someone_elses_review_is_403(client, ids):
    login(client, "bystander@test.io")
    res = client.put(f"/api/reviews/{ids['review']}", json={"review": "Nope.", "rating": 1})
    assert res.status_code == 403
    assert res.get_json()["errors"] == ["You can only edit your own reviews"]
    assert db.session.get(Review, ids["review"]).review == "Solid."


def test_owner_can_edit_their_own_review(client, ids):
    login(client, "reviewer@test.io")
    res = client.put(f"/api/reviews/{ids['review']}", json={"review": "Updated.", "rating": 5})
    assert res.status_code == 200, res.get_json()
    assert db.session.get(Review, ids["review"]).review == "Updated."
