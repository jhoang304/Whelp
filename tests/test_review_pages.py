"""
What the review pages need to know before they show a form (#112).

The edit page loads the one review it is about, rather than hoping it is on
the restaurant's first page of reviews. The write page asks the restaurant
whether the reader has already reviewed it, so it can send them to that
review instead of a form the server will refuse. A user's reviews, which used
to be GET /api/reviews/<user id>, moved to GET /api/users/<id>/reviews.
"""
from app.models import Restaurant, Review, db
from tests.conftest import login, visit


# --- one review ------------------------------------------------------------------

def test_one_review_comes_with_what_the_edit_page_shows(client, ids):
    res = client.get(f"/api/reviews/{ids['review']}")
    assert res.status_code == 200
    review = res.get_json()
    assert review["id"] == ids["review"]
    assert review["user_id"] == ids["reviewer"]
    assert review["restaurant_id"] == ids["restaurant"]
    assert review["review"] == "Solid."
    assert review["rating"] == 4
    assert review["user"]["username"] == "reviewer"
    assert "email" not in review["user"]
    assert review["restaurant"]["name"] == "Test Bistro"
    assert review["reviewImages"] == []
    assert review["response"] is None


def test_a_review_that_does_not_exist(client):
    res = client.get("/api/reviews/99999")
    assert res.status_code == 404
    assert res.get_json()["errors"] == ["Review couldn't be found"]


def test_reading_a_review_needs_no_login(client, ids):
    """Reviews are public on the restaurant page; the edit page checks who may edit."""
    visit(client)
    assert client.get(f"/api/reviews/{ids['review']}").status_code == 200


# --- a user's reviews --------------------------------------------------------------

def test_a_users_reviews_are_at_their_own_url(client, ids):
    second = Restaurant(user_id=ids["owner"], name="Second Spot", price="$", address="2 Main St",
                        city="Houston", state="TX", zipcode="77001", country="USA",
                        phone_number="(555) 555-5556", website="http://second.example.com",
                        description="Another.")
    db.session.add(second)
    db.session.commit()
    db.session.add(Review(user_id=ids["reviewer"], restaurant_id=second.id, review="Newer.", rating=5))
    db.session.commit()

    res = client.get(f"/api/users/{ids['reviewer']}/reviews")
    assert res.status_code == 200
    body = res.get_json()
    reviews = body["items"]
    assert body["total"] == 2
    assert [review["review"] for review in reviews] == ["Newer.", "Solid."]
    assert reviews[0]["restaurant"]["name"] == "Second Spot"


def test_a_user_with_no_reviews(client, ids):
    res = client.get(f"/api/users/{ids['bystander']}/reviews")
    assert res.status_code == 200
    assert res.get_json()["items"] == []
    assert res.get_json()["total"] == 0


def test_the_reviews_of_a_user_who_does_not_exist(client):
    res = client.get("/api/users/99999/reviews")
    assert res.status_code == 404
    assert res.get_json()["errors"] == ["User couldn't be found"]


# --- has the reader reviewed this restaurant? ---------------------------------------

def viewer_review_id(client, ids):
    res = client.get(f"/api/restaurants/{ids['restaurant']}")
    assert res.status_code == 200
    return res.get_json()["viewerReviewId"]


def test_the_restaurant_names_the_readers_own_review(client, ids):
    login(client, "reviewer@test.io")
    assert viewer_review_id(client, ids) == ids["review"]


def test_someone_who_has_not_reviewed_it_gets_none(client, ids):
    login(client, "bystander@test.io")
    assert viewer_review_id(client, ids) is None
    login(client, "owner@test.io")
    assert viewer_review_id(client, ids) is None


def test_a_signed_out_reader_gets_none(client, ids):
    assert viewer_review_id(client, ids) is None


def test_it_is_not_fooled_by_a_review_of_another_restaurant(client, ids):
    other = Restaurant(user_id=ids["owner"], name="Elsewhere", price="$", address="3 Main St",
                       city="Houston", state="TX", zipcode="77001", country="USA",
                       phone_number="(555) 555-5557", website="http://elsewhere.example.com",
                       description="Not this one.")
    db.session.add(other)
    db.session.commit()
    db.session.add(Review(user_id=ids["bystander"], restaurant_id=other.id, review="Elsewhere.", rating=3))
    db.session.commit()

    login(client, "bystander@test.io")
    assert viewer_review_id(client, ids) is None


# --- what the server says when it refuses a review -----------------------------------

def test_the_refusals_say_what_happened_in_plain_words(client, ids):
    """Shown to the reader verbatim, so no 'User can't add review on his own restaurant'."""
    login(client, "owner@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews", json={"review": "Best.", "rating": 5})
    assert res.status_code == 403
    assert res.get_json()["errors"] == ["You can't review your own restaurant"]

    login(client, "reviewer@test.io")
    res = client.post(f"/api/restaurants/{ids['restaurant']}/reviews", json={"review": "Again.", "rating": 5})
    assert res.status_code == 403
    assert res.get_json()["errors"] == ["You've already reviewed this restaurant"]


def test_a_users_reviews_come_a_page_at_a_time(client, ids):
    """Paged like the other feeds (#137): a prolific reviewer's profile loaded every one."""
    for n in range(4):
        place = Restaurant(user_id=ids["owner"], name=f"Spot {n}", price="$", address=f"{n} Main St",
                           city="Houston", state="TX", zipcode="77001", country="USA",
                           phone_number="(555) 555-5555", website="http://spot.com", description="Somewhere.")
        db.session.add(place)
        db.session.commit()
        db.session.add(Review(user_id=ids["reviewer"], restaurant_id=place.id, review=f"Spot {n}.", rating=4))
    db.session.commit()

    first = client.get(f"/api/users/{ids['reviewer']}/reviews?per_page=2").get_json()
    assert len(first["items"]) == 2 and first["total"] == 5 and first["per_page"] == 2

    rest = client.get(f"/api/users/{ids['reviewer']}/reviews?offset=2&per_page=10").get_json()
    assert len(rest["items"]) == 3
    seen = [review["id"] for review in first["items"] + rest["items"]]
    assert len(set(seen)) == 5

    bad = client.get(f"/api/users/{ids['reviewer']}/reviews?per_page=zero")
    assert bad.status_code == 400
