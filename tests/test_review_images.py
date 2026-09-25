"""
Who may put a photo on a review, who may take one off, and what happens to
the object in the bucket when either the photo or the review goes.

Before this, `POST /api/reviews/<id>/images` checked only that the review
existed: anyone signed in could attach any url to anyone's review, and there
was no route to remove it again. Nothing rendered review photos yet, which is
the only reason it had not mattered -- and building that display is exactly
what would have made it matter.

In the fixture, `reviewer` wrote the review, `owner` owns the restaurant it is
about, and `bystander` is neither. Only `reviewer` may add or remove its photos.
"""
from app.models import Restaurant, Review, ReviewImage, db
from tests.conftest import login
from tests.test_images import BUCKET_URL, configure_s3


def upload_by(user_id, name="photo.png"):
    """A url naming an object that user uploaded, which the API records a key for."""
    return f"{BUCKET_URL}uploads/{user_id}/{name}"


def attach(client, review_id, url):
    return client.post(f"/api/reviews/{review_id}/images", json={"url": url})


# --- adding ---------------------------------------------------------------

def test_the_author_can_add_a_photo_to_their_review(client, ids, monkeypatch):
    configure_s3(monkeypatch)
    login(client, "reviewer@test.io")

    res = attach(client, ids["review"], upload_by(ids["reviewer"]))

    assert res.status_code == 200, res.get_json()
    assert ReviewImage.query.filter_by(review_id=ids["review"]).count() == 1


def test_nobody_else_can(client, ids, monkeypatch):
    configure_s3(monkeypatch)
    login(client, "bystander@test.io")

    res = attach(client, ids["review"], "https://example.com/not-yours.png")

    assert res.status_code == 403
    assert res.get_json()["errors"] == ["You can only add photos to your own review"]
    assert ReviewImage.query.count() == 0


def test_not_even_the_restaurant_owner(client, ids, monkeypatch):
    """Owning the restaurant is authority over its photos, not over its reviews."""
    configure_s3(monkeypatch)
    login(client, "owner@test.io")

    assert attach(client, ids["review"], "https://example.com/x.png").status_code == 403
    assert ReviewImage.query.count() == 0


def test_a_stranger_cannot_use_up_the_authors_ten(client, ids, monkeypatch):
    """
    The cap was the second half of the problem: ten strangers' photos were
    also the most the author could ever add, and nothing could remove them.
    """
    configure_s3(monkeypatch)
    login(client, "bystander@test.io")
    for number in range(10):
        attach(client, ids["review"], f"https://example.com/{number}.png")
    client.get("/api/auth/logout")

    login(client, "reviewer@test.io")
    assert attach(client, ids["review"], upload_by(ids["reviewer"])).status_code == 200


def test_the_author_still_has_a_limit_of_ten(client, ids, monkeypatch):
    configure_s3(monkeypatch)
    login(client, "reviewer@test.io")
    for number in range(10):
        assert attach(client, ids["review"], f"https://example.com/{number}.png").status_code == 200

    res = attach(client, ids["review"], "https://example.com/eleven.png")

    assert res.status_code == 403
    assert "Maximum" in res.get_json()["errors"][0]


def test_a_review_that_does_not_exist_is_a_404(client, ids, monkeypatch):
    configure_s3(monkeypatch)
    login(client, "reviewer@test.io")

    assert attach(client, 9999, "https://example.com/x.png").status_code == 404


# --- removing -------------------------------------------------------------

def attached(client, ids, url=None):
    """A photo the author put on their review, and its id."""
    url = url or upload_by(ids["reviewer"])
    login(client, "reviewer@test.io")
    image_id = attach(client, ids["review"], url).get_json()["id"]
    client.get("/api/auth/logout")
    return image_id


def test_the_author_can_remove_a_photo_and_its_object_goes_too(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)
    image_id = attached(client, ids)
    login(client, "reviewer@test.io")

    res = client.delete(f"/api/review-images/{image_id}")

    assert res.status_code == 200
    assert db.session.get(ReviewImage, image_id) is None
    assert fake.deleted == [("whelp-test-bucket", f"uploads/{ids['reviewer']}/photo.png")]


def test_the_restaurant_owner_cannot_remove_a_photo_from_a_review_of_theirs(client, ids, monkeypatch):
    """
    #40 proposed letting them, as moderation. It would also let a business
    pull the photo off a bad review of itself, so the review stays the
    reviewer's to edit.
    """
    fake = configure_s3(monkeypatch)
    image_id = attached(client, ids)
    login(client, "owner@test.io")

    res = client.delete(f"/api/review-images/{image_id}")

    assert res.status_code == 403
    assert res.get_json()["errors"] == ["You can only delete photos from your own review"]
    assert db.session.get(ReviewImage, image_id) is not None
    assert fake.deleted == []


def test_anyone_else_cannot(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)
    image_id = attached(client, ids)
    login(client, "bystander@test.io")

    res = client.delete(f"/api/review-images/{image_id}")

    assert res.status_code == 403
    assert db.session.get(ReviewImage, image_id) is not None
    assert fake.deleted == []


def test_signed_out_cannot(client, ids, monkeypatch):
    configure_s3(monkeypatch)
    image_id = attached(client, ids)

    assert client.delete(f"/api/review-images/{image_id}").status_code in (302, 401)
    assert db.session.get(ReviewImage, image_id) is not None


def test_removing_a_photo_that_does_not_exist_is_a_404(client, ids, monkeypatch):
    configure_s3(monkeypatch)
    login(client, "reviewer@test.io")

    assert client.delete("/api/review-images/9999").status_code == 404


def test_an_object_attached_twice_survives_losing_one_of_them(client, ids, monkeypatch):
    """The last row to go is the one allowed to take the object with it."""
    fake = configure_s3(monkeypatch)
    url = upload_by(ids["reviewer"], "twice.png")
    first = attached(client, ids, url)
    attached(client, ids, url)
    login(client, "reviewer@test.io")

    assert client.delete(f"/api/review-images/{first}").status_code == 200
    assert fake.deleted == []


def test_a_hot_linked_photo_is_never_deleted_from_anywhere(client, ids, monkeypatch):
    """No key was minted for it, so there is nothing of ours to delete."""
    fake = configure_s3(monkeypatch)
    image_id = attached(client, ids, "https://i.imgur.com/elsewhere.png")
    login(client, "reviewer@test.io")

    assert client.delete(f"/api/review-images/{image_id}").status_code == 200
    assert fake.deleted == []


# --- when the review, or the restaurant, goes -----------------------------

def test_deleting_a_review_removes_its_photos_objects(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)
    attached(client, ids, upload_by(ids["reviewer"], "a.png"))
    attached(client, ids, "https://i.imgur.com/elsewhere.png")
    login(client, "reviewer@test.io")

    assert client.delete(f"/api/reviews/{ids['review']}").status_code == 200
    assert ReviewImage.query.count() == 0
    assert fake.deleted == [("whelp-test-bucket", f"uploads/{ids['reviewer']}/a.png")]


def test_deleting_a_restaurant_removes_its_reviews_photos_too(client, ids, monkeypatch):
    """
    The cascade goes restaurant, reviews, review photos. Only the restaurant's
    own photos used to be collected on the way, so every review photo's object
    was left behind.
    """
    fake = configure_s3(monkeypatch)
    attached(client, ids, upload_by(ids["reviewer"], "on-a-review.png"))
    login(client, "owner@test.io")

    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code == 200
    assert db.session.get(Restaurant, ids["restaurant"]) is None
    assert Review.query.count() == 0
    assert ("whelp-test-bucket", f"uploads/{ids['reviewer']}/on-a-review.png") in fake.deleted
