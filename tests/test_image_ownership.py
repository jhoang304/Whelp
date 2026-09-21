"""
An object in the bucket may only be deleted through a key this app minted for
the caller who uploaded it.

Before this, an image row stored whatever url the caller typed and every
cleanup path turned that url back into a key and deleted it -- so typing a
stranger's url was authority to destroy their image. These tests walk the
three routes the issue names.
"""
from app.api import aws_helpers
from app.models import RestaurantImage, ReviewImage, User, db
from tests.conftest import login
from tests.test_images import BUCKET_URL, configure_s3


def their_upload(user_id, name="private.png"):
    """A url naming an object somebody else uploaded."""
    return f"{BUCKET_URL}uploads/{user_id}/{name}"


def test_an_upload_gets_a_key_scoped_to_its_uploader(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)
    login(client, "reviewer@test.io")

    res = client.post("/api/images/upload", data={"image": (__import__("io").BytesIO(b"png"), "x.png")},
                      content_type="multipart/form-data")
    assert res.status_code == 201, res.get_json()

    key = fake.uploaded[0]["Key"]
    assert key.startswith(f"uploads/{ids['reviewer']}/"), key
    assert res.get_json()["url"].endswith(key)


def test_attaching_your_own_upload_records_the_key(client, ids, monkeypatch):
    configure_s3(monkeypatch)
    login(client, "owner@test.io")
    url = their_upload(ids["owner"], "mine.png")

    res = client.post(f"/api/restaurants/{ids['restaurant']}/images",
                      json={"url": url, "preview": False})
    assert res.status_code == 200, res.get_json()

    image = RestaurantImage.query.filter_by(url=url).one()
    assert image.s3_key == f"uploads/{ids['owner']}/mine.png"


def test_attaching_someone_elses_upload_records_no_key(client, ids, monkeypatch):
    """The attach still works -- it is a link -- but it carries no authority."""
    configure_s3(monkeypatch)
    login(client, "bystander@test.io")
    url = their_upload(ids["owner"])

    res = client.post(f"/api/restaurants/{ids['restaurant']}/images",
                      json={"url": url, "preview": False})
    assert res.status_code == 200, res.get_json()
    assert RestaurantImage.query.filter_by(url=url).one().s3_key is None


def test_deleting_that_row_leaves_the_stranger_s_object_alone(client, ids, monkeypatch):
    """Route 2 from the issue: attach any url, delete the row, object gone."""
    fake = configure_s3(monkeypatch)
    login(client, "bystander@test.io")
    url = their_upload(ids["owner"])
    client.post(f"/api/restaurants/{ids['restaurant']}/images", json={"url": url, "preview": False})
    attached = RestaurantImage.query.filter_by(url=url).one()

    assert client.delete(f"/api/restaurant-images/{attached.id}").status_code == 200
    assert fake.deleted == [], "somebody else's object must survive"


def test_deleting_your_own_upload_removes_the_object(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)
    login(client, "owner@test.io")
    url = their_upload(ids["owner"], "mine.png")
    client.post(f"/api/restaurants/{ids['restaurant']}/images", json={"url": url, "preview": False})
    attached = RestaurantImage.query.filter_by(url=url).one()

    assert client.delete(f"/api/restaurant-images/{attached.id}").status_code == 200
    assert fake.deleted == [("whelp-test-bucket", f"uploads/{ids['owner']}/mine.png")]


def test_deleting_a_restaurant_leaves_strangers_objects_alone(client, ids, monkeypatch):
    """Route 3: attach to your own restaurant, then delete the restaurant."""
    fake = configure_s3(monkeypatch)
    login(client, "owner@test.io")
    theirs = their_upload(ids["reviewer"])
    mine = their_upload(ids["owner"], "mine.png")
    client.post(f"/api/restaurants/{ids['restaurant']}/images", json={"url": theirs, "preview": False})
    client.post(f"/api/restaurants/{ids['restaurant']}/images", json={"url": mine, "preview": False})

    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code == 200
    assert [key for _, key in fake.deleted] == [f"uploads/{ids['owner']}/mine.png"]


def test_a_profile_picture_cannot_delete_someone_elses(client, ids, monkeypatch):
    """
    Route 1, the shortest way in: point your profile picture at a stranger's
    upload, then change it, and the old value used to be deleted from S3.
    """
    fake = configure_s3(monkeypatch)
    login(client, "bystander@test.io")
    theirs = their_upload(ids["owner"])

    res = client.put(f"/api/users/{ids['bystander']}/edit",
                     json={"username": "bystander", "profile_image_url": theirs})
    assert res.status_code == 200, res.get_json()
    assert db.session.get(User, ids["bystander"]).profile_image_key is None

    res = client.put(f"/api/users/{ids['bystander']}/edit",
                     json={"username": "bystander", "profile_image_url": ""})
    assert res.status_code == 200, res.get_json()
    assert fake.deleted == [], "the picture belonged to someone else"


def test_replacing_your_own_profile_picture_removes_the_old_object(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)
    login(client, "bystander@test.io")
    mine = their_upload(ids["bystander"], "avatar.png")

    client.put(f"/api/users/{ids['bystander']}/edit",
               json={"username": "bystander", "profile_image_url": mine})
    assert db.session.get(User, ids["bystander"]).profile_image_key == \
        f"uploads/{ids['bystander']}/avatar.png"

    client.put(f"/api/users/{ids['bystander']}/edit",
               json={"username": "bystander", "profile_image_url": ""})
    assert fake.deleted == [("whelp-test-bucket", f"uploads/{ids['bystander']}/avatar.png")]


def test_a_review_image_records_its_uploader_too(client, ids, monkeypatch):
    configure_s3(monkeypatch)
    login(client, "reviewer@test.io")
    theirs = their_upload(ids["owner"])
    mine = their_upload(ids["reviewer"], "mine.png")

    client.post(f"/api/reviews/{ids['review']}/images", json={"url": theirs})
    client.post(f"/api/reviews/{ids['review']}/images", json={"url": mine})

    assert ReviewImage.query.filter_by(url=theirs).one().s3_key is None
    assert ReviewImage.query.filter_by(url=mine).one().s3_key == f"uploads/{ids['reviewer']}/mine.png"


def test_a_hot_linked_image_is_never_deleted(client, ids, monkeypatch):
    fake = configure_s3(monkeypatch)
    login(client, "owner@test.io")
    url = "https://i.imgur.com/c7KuGow.png"
    client.post(f"/api/restaurants/{ids['restaurant']}/images", json={"url": url, "preview": False})
    attached = RestaurantImage.query.filter_by(url=url).one()

    assert attached.s3_key is None
    assert client.delete(f"/api/restaurant-images/{attached.id}").status_code == 200
    assert fake.deleted == []


def test_key_uploaded_by_only_answers_for_that_user(monkeypatch):
    configure_s3(monkeypatch)
    url = f"{BUCKET_URL}uploads/7/abc.png"
    assert aws_helpers.key_uploaded_by(url, 7) == "uploads/7/abc.png"
    assert aws_helpers.key_uploaded_by(url, 8) is None
    assert aws_helpers.key_uploaded_by(f"{BUCKET_URL}legacy.png", 7) is None, "pre-key object"
    assert aws_helpers.key_uploaded_by("https://i.imgur.com/x.png", 7) is None
