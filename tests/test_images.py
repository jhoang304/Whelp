import io
import urllib.error

import botocore.exceptions

from app.api import aws_helpers
from app.models import Restaurant, RestaurantImage, Review, ReviewImage, db
from tests.conftest import login


class FakeS3:
    """Records put_object/delete_object calls; can mimic a bucket with ACLs disabled."""

    def __init__(self, acls_disabled=False):
        self.acls_disabled = acls_disabled
        self.uploaded = []  # list of put_object kwargs
        self.deleted = []
        self.refused = set()  # keys delete_objects should report as failures

    def put_object(self, **kwargs):
        self.uploaded.append(kwargs)
        if self.acls_disabled and "ACL" in kwargs:
            raise botocore.exceptions.ClientError(
                {"Error": {"Code": "AccessControlListNotSupported",
                           "Message": "The bucket does not allow ACLs"}},
                "PutObject",
            )

    def delete_object(self, Bucket, Key):
        self.deleted.append((Bucket, Key))

    def delete_objects(self, Bucket, Delete, refuse=()):
        """S3 answers 200 with per-key Errors; `refuse` mimics that."""
        errors = []
        for entry in Delete["Objects"]:
            if entry["Key"] in self.refused:
                errors.append({"Key": entry["Key"], "Code": "AccessDenied",
                               "Message": "Access Denied"})
                continue
            self.deleted.append((Bucket, entry["Key"]))
        return {"Deleted": [], "Errors": errors}


def configure_s3(monkeypatch, acls_disabled=False, public=True):
    monkeypatch.setenv("S3_BUCKET", "whelp-test-bucket")
    monkeypatch.setenv("S3_KEY", "AKIATEST")
    monkeypatch.setenv("S3_SECRET", "secret")
    fake = FakeS3(acls_disabled=acls_disabled)
    monkeypatch.setattr(aws_helpers, "_s3_client", fake)
    # never hit the network from tests
    monkeypatch.setattr(aws_helpers, "_object_is_public", lambda url: public)
    return fake


CONTENT = b"\x89PNG fake bytes that must survive a retry"


def upload(client, filename="photo.png", content=CONTENT):
    return client.post(
        "/api/images/upload",
        data={"image": (io.BytesIO(content), filename)},
        content_type="multipart/form-data",
    )


def test_upload_requires_login(client):
    assert upload(client).status_code in (302, 401)  # Flask-Login redirects to /api/auth/unauthorized


def test_upload_returns_503_when_s3_not_configured(client):
    login(client, "reviewer@test.io")
    res = upload(client)
    assert res.status_code == 503
    assert "not configured" in res.get_json()["errors"][0]


def test_upload_success_returns_bucket_url(client, monkeypatch):
    fake = configure_s3(monkeypatch)
    login(client, "reviewer@test.io")
    res = upload(client)
    assert res.status_code == 201, res.get_json()
    url = res.get_json()["url"]
    assert url.startswith("https://whelp-test-bucket.s3.amazonaws.com/")
    assert url.endswith(".png")

    assert len(fake.uploaded) == 1
    call = fake.uploaded[0]
    assert call["Bucket"] == "whelp-test-bucket"
    assert url.endswith(call["Key"])
    assert call["Key"] != "photo.png", "filenames must be made unique"
    assert call["Body"] == CONTENT
    assert call["ContentType"] == "image/png"
    assert call["ACL"] == "public-read"


def test_upload_retries_without_acl_when_bucket_disables_acls(client, monkeypatch):
    """Regression: the retry used to read from a file boto3 had already closed."""
    fake = configure_s3(monkeypatch, acls_disabled=True)
    login(client, "reviewer@test.io")
    res = upload(client)
    assert res.status_code == 201, res.get_json()

    assert len(fake.uploaded) == 2
    first, second = fake.uploaded
    assert first["ACL"] == "public-read"
    assert "ACL" not in second
    assert second["Key"] == first["Key"]
    assert second["Body"] == CONTENT, "the retry must resend the whole file"


def test_upload_fails_clearly_when_object_is_not_publicly_readable(client, monkeypatch):
    fake = configure_s3(monkeypatch, acls_disabled=True, public=False)
    login(client, "reviewer@test.io")
    res = upload(client)
    assert res.status_code == 400
    assert "public reads" in res.get_json()["errors"][0]
    # the unreadable object is cleaned up
    assert len(fake.deleted) == 1
    assert fake.deleted[0][1] == fake.uploaded[-1]["Key"]


def test_upload_reports_other_s3_errors(client, monkeypatch):
    fake = configure_s3(monkeypatch)

    def failing_put(**kwargs):
        raise botocore.exceptions.ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}}, "PutObject")

    fake.put_object = failing_put
    login(client, "reviewer@test.io")
    res = upload(client)
    assert res.status_code == 400
    assert "AccessDenied" in res.get_json()["errors"][0]


def test_upload_rejects_disallowed_extension(client, monkeypatch):
    configure_s3(monkeypatch)
    login(client, "reviewer@test.io")
    res = upload(client, filename="malware.exe")
    assert res.status_code == 400
    assert any("allowed" in e for e in res.get_json()["errors"])


def test_upload_without_file_is_400(client, monkeypatch):
    configure_s3(monkeypatch)
    login(client, "reviewer@test.io")
    res = client.post("/api/images/upload", data={}, content_type="multipart/form-data")
    assert res.status_code == 400


def test_object_is_public_treats_only_403_as_private(monkeypatch):
    def fake_urlopen(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, None)

    monkeypatch.setattr(aws_helpers.urllib.request, "urlopen", fake_urlopen)
    assert aws_helpers._object_is_public("https://whelp-test-bucket.s3.amazonaws.com/x.png") is False

    def flaky_urlopen(request, timeout):
        raise OSError("network down")

    monkeypatch.setattr(aws_helpers.urllib.request, "urlopen", flaky_urlopen)
    assert aws_helpers._object_is_public("https://whelp-test-bucket.s3.amazonaws.com/x.png") is True


def test_remove_key_from_s3_deletes_the_key_it_is_given(monkeypatch):
    fake = configure_s3(monkeypatch)
    assert aws_helpers.remove_key_from_s3("uploads/1/abc.png") is True
    assert fake.deleted == [("whelp-test-bucket", "uploads/1/abc.png")]
    assert aws_helpers.remove_key_from_s3(None) is False
    assert len(fake.deleted) == 1


def test_delete_restaurant_image_permissions(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)
    # a random logged-in user may not delete
    login(client, "bystander@test.io")
    assert client.delete(f"/api/restaurant-images/{ids['image']}").status_code == 403
    client.get("/api/auth/logout")

    # the restaurant owner may (the image url is not on our bucket, so S3 is untouched)
    login(client, "owner@test.io")
    assert client.delete(f"/api/restaurant-images/{ids['image']}").status_code == 200
    assert client.delete(f"/api/restaurant-images/{ids['image']}").status_code == 404
    assert fake.deleted == []


BUCKET_URL = "https://whelp-test-bucket.s3.amazonaws.com/"


def test_remove_keys_from_s3_batches(monkeypatch):
    fake = configure_s3(monkeypatch)
    deleted = aws_helpers.remove_keys_from_s3(["uploads/1/one.png", None, "uploads/1/two.jpg"])
    assert deleted == ["uploads/1/one.png", "uploads/1/two.jpg"]
    assert fake.deleted == [("whelp-test-bucket", "uploads/1/one.png"),
                            ("whelp-test-bucket", "uploads/1/two.jpg")]


def test_remove_keys_from_s3_without_keys_makes_no_call(monkeypatch):
    """A row with no key -- hot-linked, or someone else's upload -- deletes nothing."""
    fake = configure_s3(monkeypatch)
    assert aws_helpers.remove_keys_from_s3([None, ""]) == []
    assert fake.deleted == []


def test_deleting_a_restaurant_removes_its_uploaded_photos(client, ids, monkeypatch):
    """Regression: the cascade dropped the rows but orphaned the S3 objects."""
    fake = configure_s3(monkeypatch)
    db.session.add_all([
        RestaurantImage(restaurant_id=ids["restaurant"], url=f"{BUCKET_URL}uploaded-1.png",
                        s3_key="uploaded-1.png", preview=False, createdByUserId=ids["owner"]),
        RestaurantImage(restaurant_id=ids["restaurant"], url=f"{BUCKET_URL}uploaded-2.png",
                        s3_key="uploaded-2.png", preview=False, createdByUserId=ids["reviewer"]),
    ])
    db.session.commit()

    login(client, "owner@test.io")
    res = client.delete(f"/api/restaurants/{ids['restaurant']}")
    assert res.status_code == 200, res.get_json()

    assert db.session.get(Restaurant, ids["restaurant"]) is None
    assert RestaurantImage.query.filter_by(restaurant_id=ids["restaurant"]).count() == 0
    # every uploaded object is gone; the seeded example.com image is left alone
    assert sorted(key for _, key in fake.deleted) == ["uploaded-1.png", "uploaded-2.png"]


def test_deleting_a_restaurant_without_uploads_touches_s3_not_at_all(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)
    login(client, "owner@test.io")
    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code == 200
    assert fake.deleted == []


def test_a_refused_delete_leaves_the_bucket_alone(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)
    db.session.add(RestaurantImage(restaurant_id=ids["restaurant"], url=f"{BUCKET_URL}uploaded-1.png",
                                   preview=False, createdByUserId=ids["owner"]))
    db.session.commit()

    login(client, "bystander@test.io")
    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code == 403
    assert fake.deleted == []
    assert db.session.get(Restaurant, ids["restaurant"]) is not None


def test_a_bucket_failure_does_not_fail_the_delete(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)

    def failing_delete(Bucket, Delete):
        raise botocore.exceptions.ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}}, "DeleteObjects")

    fake.delete_objects = failing_delete
    db.session.add(RestaurantImage(restaurant_id=ids["restaurant"], url=f"{BUCKET_URL}uploaded-1.png",
                                   preview=False, createdByUserId=ids["owner"]))
    db.session.commit()

    login(client, "owner@test.io")
    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code == 200
    assert db.session.get(Restaurant, ids["restaurant"]) is None


def test_remove_keys_from_s3_excludes_keys_s3_refused(monkeypatch):
    """DeleteObjects answers 200 with per-key Errors; those are not deleted."""
    fake = configure_s3(monkeypatch)
    fake.refused = {"locked.png"}
    deleted = aws_helpers.remove_keys_from_s3(["one.png", "locked.png", "two.jpg"])
    assert deleted == ["one.png", "two.jpg"]
    assert sorted(key for _, key in fake.deleted) == ["one.png", "two.jpg"]


def test_delete_does_not_remove_an_object_another_row_still_shows(client, ids, monkeypatch):
    """
    One upload can be attached in two places by the user who owns it, so the
    last row to go is the one that may delete the object.
    """
    fake = configure_s3(monkeypatch)
    shared = f"{BUCKET_URL}shared.png"
    other = Restaurant(
        user_id=ids["owner"], name="Second Bistro", price="$", address="9 Side St",
        city="Austin", state="TX", zipcode="78701", country="USA",
        phone_number="(555) 222-3333", website="http://second.com", description="Another.")
    db.session.add(other)
    db.session.commit()
    db.session.add_all([
        RestaurantImage(restaurant_id=ids["restaurant"], url=shared, s3_key="shared.png",
                        preview=False, createdByUserId=ids["owner"]),
        RestaurantImage(restaurant_id=other.id, url=shared, s3_key="shared.png",
                        preview=False, createdByUserId=ids["owner"]),
        RestaurantImage(restaurant_id=ids["restaurant"], url=f"{BUCKET_URL}only-mine.png",
                        s3_key="only-mine.png", preview=False, createdByUserId=ids["owner"]),
    ])
    db.session.commit()

    login(client, "owner@test.io")
    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code == 200

    keys = sorted(key for _, key in fake.deleted)
    assert keys == ["only-mine.png"], "the shared object is still in use"


def test_delete_does_not_remove_an_object_another_reviews_image_still_shows(client, ids, monkeypatch):
    """
    The review image has to hang off a review on a *different* restaurant: the
    deleted restaurant's own reviews (and their images) cascade away with it,
    so those objects really are orphaned.
    """
    fake = configure_s3(monkeypatch)
    shared = f"{BUCKET_URL}shared-with-review.png"

    other = Restaurant(
        user_id=ids["bystander"], name="Third Bistro", price="$", address="3 Far St",
        city="Dallas", state="TX", zipcode="75201", country="USA",
        phone_number="(555) 444-5555", website="http://third.com", description="Elsewhere.")
    db.session.add(other)
    db.session.commit()

    elsewhere = Review(user_id=ids["reviewer"], restaurant_id=other.id,
                       review="Good too.", rating=5)
    db.session.add(elsewhere)
    db.session.commit()

    db.session.add_all([
        RestaurantImage(restaurant_id=ids["restaurant"], url=shared, preview=False,
                        createdByUserId=ids["owner"]),
        ReviewImage(review_id=elsewhere.id, url=shared),
    ])
    db.session.commit()

    login(client, "owner@test.io")
    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code == 200
    assert fake.deleted == [], "another review still displays this object"
