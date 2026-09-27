"""Helpers for storing user-uploaded images in an AWS S3 bucket.

Configuration comes from three environment variables:

    S3_BUCKET  - name of the bucket
    S3_KEY     - access key id of an IAM user with PutObject/DeleteObject
    S3_SECRET  - the matching secret access key

When they are missing the app still boots; the upload endpoint responds
with a clear 503 so URL-based images keep working in local development.

Uploaded photos are served straight from the bucket, so objects must be
publicly readable: either through a bucket policy granting s3:GetObject
(the only option when the bucket has ACLs disabled, which is the AWS
default) or through the public-read ACL this module tries first.
"""
import os
import urllib.error
import urllib.request
import uuid
from collections import namedtuple

import boto3
import botocore
from flask import current_app

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

# What an upload's bytes turn out to be. The type stored with the object, and
# the key's extension, come from here -- never from the client's filename or
# Content-Type, which let an HTML page named photo.png be stored as text/html
# in a public bucket, where it rendered as a web page on the bucket's domain
# (#110).
ImageKind = namedtuple("ImageKind", ["extension", "content_type"])

_SIGNATURES = (
    (b"\x89PNG\r\n\x1a\n", ImageKind("png", "image/png")),
    (b"\xff\xd8\xff", ImageKind("jpg", "image/jpeg")),
    (b"GIF87a", ImageKind("gif", "image/gif")),
    (b"GIF89a", ImageKind("gif", "image/gif")),
)


def sniff_image(data):
    """The ImageKind these bytes start like, or None when they are not a PNG, JPEG, GIF or WebP."""
    for signature, kind in _SIGNATURES:
        if data.startswith(signature):
            return kind
    # RIFF, four bytes of length, then WEBP.
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ImageKind("webp", "image/webp")
    return None


# Shown instead of whatever S3 said, which named the bucket's configuration
# ("The AWS Access Key Id you provided does not exist in our records") to
# anyone uploading a photo. The real error goes to the log.
UPLOAD_FAILED_MESSAGE = "The photo could not be uploaded. Please try again."

NOT_PUBLIC_MESSAGE = (
    "The photo was uploaded, but the bucket does not allow public reads, so it "
    "would not display. Add a bucket policy that grants s3:GetObject on the "
    "bucket's objects (see the README), then try again."
)

_s3_client = None


def _settings():
    bucket = os.environ.get("S3_BUCKET")
    return {
        "bucket": bucket,
        "key": os.environ.get("S3_KEY"),
        "secret": os.environ.get("S3_SECRET"),
        "location": f"https://{bucket}.s3.amazonaws.com/" if bucket else None,
    }


def s3_configured():
    s = _settings()
    return bool(s["bucket"] and s["key"] and s["secret"])


def _client():
    global _s3_client
    if _s3_client is None:
        s = _settings()
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=s["key"],
            aws_secret_access_key=s["secret"],
        )
    return _s3_client


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


UPLOAD_PREFIX = "uploads"


def upload_key(user_id, extension):
    """
    The key this app mints for an upload, scoped to whoever uploaded it.

    The user segment is what makes an object's ownership readable later: a row
    may only claim a key that names the caller, so attaching a stranger's URL
    records no key and can never delete their object. Keys minted before this
    (a bare uuid) name nobody, which is the safe answer.

    `extension` is the one the bytes were sniffed as, not the filename's.
    """
    return f"{UPLOAD_PREFIX}/{user_id}/{uuid.uuid4().hex}.{extension}"


def key_from_url(image_url):
    """The object key a URL names, when the URL is one of ours."""
    s = _settings()
    if not (image_url and s["location"] and image_url.startswith(s["location"])):
        return None
    return image_url[len(s["location"]):] or None


def key_uploaded_by(image_url, user_id):
    """
    The object key, but only when this app minted it for that user.

    None for someone else's upload, an object older than user-scoped keys, or
    a hot-linked image -- all of which a row then stores without a key, and so
    can never delete.
    """
    key = key_from_url(image_url)
    if key and key.startswith(f"{UPLOAD_PREFIX}/{user_id}/"):
        return key
    return None


def upload_file_to_s3(key, data, content_type, acl="public-read"):
    """
    Put `data` in the bucket at `key`, stored as `content_type`, and return
    {"url": ...} -- or {"errors": message, "status": code} for the route to
    answer with.

    Takes bytes, read once up front and sent with put_object: boto3's
    upload_fileobj closes the file object even when the request fails, which
    made the ACL retry below read from a closed file. Uploads are capped at
    MAX_UPLOAD_BYTES, so holding them in memory is fine.
    """
    s = _settings()
    if not s3_configured():
        return {"errors": "Image uploads are not configured on this server.", "status": 503}

    result = _put_object(s, key, data, content_type, acl)

    if "url" in result and not _object_is_public(result["url"]):
        # Don't leave an unreadable object behind; tell the owner what to fix.
        # By key, like every other delete, so this needs no url to work
        # backwards from.
        remove_key_from_s3(key)
        return {"errors": NOT_PUBLIC_MESSAGE, "status": 400}

    return result


def _put_object(s, key, data, content_type, acl):
    params = {
        "Bucket": s["bucket"],
        "Key": key,
        "Body": data,
        "ContentType": content_type,
    }
    if acl:
        params["ACL"] = acl

    try:
        _client().put_object(**params)
    except botocore.exceptions.ClientError as e:
        # Buckets created with "ACLs disabled" (the current AWS default) reject
        # the ACL header. Retry once without it; the bucket policy must then
        # grant public read.
        if acl and e.response.get("Error", {}).get("Code") == "AccessControlListNotSupported":
            return _put_object(s, key, data, content_type, None)
        current_app.logger.exception("S3 refused an upload to %s", key)
        return {"errors": UPLOAD_FAILED_MESSAGE, "status": 502}
    except Exception:
        current_app.logger.exception("Uploading %s to S3 failed", key)
        return {"errors": UPLOAD_FAILED_MESSAGE, "status": 502}

    return {"url": f"{s['location']}{key}"}


def _object_is_public(url):
    """False only when an anonymous HEAD request is explicitly refused (403)."""
    request = urllib.request.Request(url, method="HEAD")
    try:
        urllib.request.urlopen(request, timeout=5)
    except urllib.error.HTTPError as e:
        return e.code != 403
    except Exception:
        # A network hiccup should not fail an upload that already succeeded.
        return True
    return True


def is_s3_url(image_url):
    s = _settings()
    return bool(image_url and s["location"] and image_url.startswith(s["location"]))


def remove_keys_from_s3(object_keys):
    """Best-effort delete of several objects we minted keys for, batched.

    S3 takes up to 1000 keys per delete_objects call, so a restaurant with
    a handful of photos costs one request instead of one per photo. Takes keys
    rather than urls: a url is whatever a caller typed, and deriving a key
    from one made typing a stranger's url authority to delete their object.
    Returns the keys S3 was asked to delete.
    """
    if not s3_configured():
        return []

    s = _settings()
    keys = [key for key in object_keys if key]
    if not keys:
        return []

    deleted = []
    for start in range(0, len(keys), 1000):
        chunk = keys[start:start + 1000]
        try:
            response = _client().delete_objects(
                Bucket=s["bucket"],
                Delete={"Objects": [{"Key": key} for key in chunk]},
            )
        except Exception as e:
            print(f"[aws_helpers] failed to delete {len(chunk)} object(s): {e}")
            continue

        # DeleteObjects answers 200 for a request S3 accepted even when some of
        # the keys in it failed; those come back under Errors rather than as an
        # exception. Reporting the whole chunk as deleted would hide objects
        # that are still in the bucket.
        failures = (response or {}).get("Errors") or []
        failed_keys = {failure.get("Key") for failure in failures}
        for failure in failures:
            print(f"[aws_helpers] S3 refused to delete {failure.get('Key')}: "
                  f"{failure.get('Code')} {failure.get('Message')}")

        deleted.extend(key for key in chunk if key not in failed_keys)
    return deleted


def remove_key_from_s3(object_key):
    """Best-effort delete of one object by the key this app minted for it."""
    if not s3_configured() or not object_key:
        return False
    s = _settings()
    key = object_key
    try:
        _client().delete_object(Bucket=s["bucket"], Key=key)
    except Exception as e:
        print(f"[aws_helpers] failed to delete {key}: {e}")
        return False
    return True
