import io

from app.api import aws_helpers
from tests.conftest import login


class FakeS3:
    def __init__(self):
        self.uploaded = []
        self.deleted = []

    def upload_fileobj(self, fileobj, bucket, key, ExtraArgs=None):
        self.uploaded.append((bucket, key, ExtraArgs))

    def delete_object(self, Bucket, Key):
        self.deleted.append((Bucket, Key))


def configure_s3(monkeypatch):
    monkeypatch.setenv("S3_BUCKET", "whelp-test-bucket")
    monkeypatch.setenv("S3_KEY", "AKIATEST")
    monkeypatch.setenv("S3_SECRET", "secret")
    fake = FakeS3()
    monkeypatch.setattr(aws_helpers, "_s3_client", fake)
    return fake


def upload(client, filename="photo.png", content=b"\x89PNG fake bytes"):
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
    bucket, key, extra = fake.uploaded[0]
    assert bucket == "whelp-test-bucket"
    assert url.endswith(key)
    assert key != "photo.png", "filenames must be made unique"
    assert extra["ACL"] == "public-read"


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


def test_remove_file_from_s3_only_touches_our_bucket(monkeypatch):
    fake = configure_s3(monkeypatch)
    assert aws_helpers.remove_file_from_s3("https://whelp-test-bucket.s3.amazonaws.com/abc.png") is True
    assert fake.deleted == [("whelp-test-bucket", "abc.png")]
    assert aws_helpers.remove_file_from_s3("https://i.imgur.com/other.png") is False
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
