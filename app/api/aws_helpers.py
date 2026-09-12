"""Helpers for storing user-uploaded images in an AWS S3 bucket.

Configuration comes from three environment variables:

    S3_BUCKET  - name of the bucket
    S3_KEY     - access key id of an IAM user with PutObject/DeleteObject
    S3_SECRET  - the matching secret access key

When they are missing the app still boots; the upload endpoint responds
with a clear 503 so URL-based images keep working in local development.
"""
import os
import uuid

import boto3
import botocore

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

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


def get_unique_filename(filename):
    ext = filename.rsplit(".", 1)[1].lower()
    return f"{uuid.uuid4().hex}.{ext}"


def upload_file_to_s3(file, acl="public-read"):
    """Upload a werkzeug FileStorage to S3 and return {"url": ...} or {"errors": ...}."""
    s = _settings()
    if not s3_configured():
        return {"errors": "Image uploads are not configured on this server."}

    extra_args = {"ContentType": file.content_type or "application/octet-stream"}
    if acl:
        extra_args["ACL"] = acl

    try:
        _client().upload_fileobj(file, s["bucket"], file.filename, ExtraArgs=extra_args)
    except botocore.exceptions.ClientError as e:
        # Buckets created with "ACLs disabled" (the current AWS default) reject
        # the ACL header. Retry once without it and rely on the bucket policy.
        if acl and e.response.get("Error", {}).get("Code") == "AccessControlListNotSupported":
            try:
                file.stream.seek(0)
            except Exception:
                pass
            return upload_file_to_s3(file, acl=None)
        return {"errors": str(e)}
    except Exception as e:
        return {"errors": str(e)}

    return {"url": f"{s['location']}{file.filename}"}


def is_s3_url(image_url):
    s = _settings()
    return bool(image_url and s["location"] and image_url.startswith(s["location"]))


def remove_file_from_s3(image_url):
    """Best-effort delete of an object we uploaded. Ignores URLs from other hosts."""
    if not s3_configured() or not is_s3_url(image_url):
        return False
    s = _settings()
    key = image_url[len(s["location"]):]
    try:
        _client().delete_object(Bucket=s["bucket"], Key=key)
    except Exception as e:
        print(f"[aws_helpers] failed to delete {key}: {e}")
        return False
    return True
