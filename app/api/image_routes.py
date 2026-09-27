from flask import Blueprint, request
from flask_limiter.util import get_remote_address
from flask_login import current_user, login_required

from app.extensions import limiter
from app.forms import ImageUploadForm
from app.api.utils import error_messages
from app.api.aws_helpers import (
    MAX_UPLOAD_BYTES,
    s3_configured,
    sniff_image,
    upload_file_to_s3,
    upload_key,
)

image_routes = Blueprint('images', __name__)

TOO_LARGE_MESSAGE = f"Images must be smaller than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."


def per_uploader():
    """One allowance per signed-in user, however many addresses they come from."""
    if current_user.is_authenticated:
        return f"user:{current_user.id}"
    return get_remote_address()


@image_routes.route('/upload', methods=['POST'])
# Every upload lands in a paid bucket. Enough for a review's ten photos at
# once, and then some; not enough to fill the bucket from a script.
@limiter.limit("20 per minute;100 per hour", key_func=per_uploader,
               error_message="That's a lot of photos at once. Please wait a few minutes and try again.")
@login_required
def upload_image():
    """
    Upload one image (multipart/form-data field `image`) to S3 and return its
    public URL as {"url": ...}. The URL can then be saved as a restaurant
    image, profile picture, or review image through the existing JSON routes,
    which recognise the key inside it as this caller's and record it -- that
    recorded key, never the url, is what a later delete acts on.

    The size limit is enforced twice. MAX_CONTENT_LENGTH (app/config.py)
    stops the request body while it streams in, which is what catches a
    chunked upload: it has no Content-Length for a check here to read, and
    used to reach the bucket at any size (#110). Then the file itself is
    measured, since the body's limit allows for multipart overhead.
    """
    if not s3_configured():
        return {
            "errors": [
                "Image uploads are not configured on this server. "
                "Set S3_BUCKET, S3_KEY, and S3_SECRET, or paste an image URL instead."
            ]
        }, 503

    form = ImageUploadForm()
    form["csrf_token"].data = request.cookies.get("csrf_token")
    if not form.validate_on_submit():
        return {"errors": error_messages(form.errors)}, 400

    data = form.data["image"].read()
    if len(data) > MAX_UPLOAD_BYTES:
        return {"errors": [TOO_LARGE_MESSAGE]}, 413

    kind = sniff_image(data)
    if kind is None:
        return {"errors": ["That file isn't a PNG, JPG, GIF or WEBP image."]}, 400

    upload = upload_file_to_s3(upload_key(current_user.id, kind.extension), data, kind.content_type)
    if "url" not in upload:
        return {"errors": [upload["errors"]]}, upload["status"]

    return {"url": upload["url"]}, 201
