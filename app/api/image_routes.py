from flask import Blueprint, request
from flask_login import current_user, login_required

from app.forms import ImageUploadForm
from app.api.utils import error_messages
from app.api.aws_helpers import (
    MAX_UPLOAD_BYTES,
    get_unique_filename,
    s3_configured,
    upload_file_to_s3,
)

image_routes = Blueprint('images', __name__)


@image_routes.route('/upload', methods=['POST'])
@login_required
def upload_image():
    """
    Upload one image (multipart/form-data field `image`) to S3 and return its
    public URL as {"url": ...}. The URL can then be saved as a restaurant
    image, profile picture, or review image through the existing JSON routes,
    which recognise the key inside it as this caller's and record it -- that
    recorded key, never the url, is what a later delete acts on.
    """
    if not s3_configured():
        return {
            "errors": [
                "Image uploads are not configured on this server. "
                "Set S3_BUCKET, S3_KEY, and S3_SECRET, or paste an image URL instead."
            ]
        }, 503

    if request.content_length and request.content_length > MAX_UPLOAD_BYTES:
        return {"errors": [f"Images must be smaller than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."]}, 413

    form = ImageUploadForm()
    form["csrf_token"].data = request.cookies.get("csrf_token")
    if not form.validate_on_submit():
        return {"errors": error_messages(form.errors)}, 400

    image = form.data["image"]
    image.filename = get_unique_filename(image.filename, current_user.id)
    upload = upload_file_to_s3(image)

    if "url" not in upload:
        return {"errors": [upload.get("errors", "Upload failed.")]}, 400

    return {"url": upload["url"]}, 201
