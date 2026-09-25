from flask import Blueprint
from flask_login import current_user, login_required

from app.api.aws_helpers import remove_key_from_s3
from app.api.utils import key_still_referenced
from app.models import ReviewImage, db

review_image_routes = Blueprint('reviewImages', __name__)


@review_image_routes.route('/<int:imageId>', methods=["DELETE"])
@login_required
def delete_review_image(imageId):
    """
    Delete a photo from a review. The review's author only.

    Not the owner of the restaurant, though #40 proposed it: a business able
    to remove photos from reviews of itself can quietly take the evidence off
    a bad one, and the review is the reviewer's to edit.

    There was no way to remove a review photo at all before this, short of a
    query against the database -- so anything attached stayed attached.
    """
    image = db.session.get(ReviewImage, imageId)
    if not image:
        return {"errors": ["Image couldn't be found"]}, 404

    if image.review is None or image.review.user_id != current_user.id:
        return {"errors": ["You can only delete photos from your own review"]}, 403

    object_key = image.s3_key
    db.session.delete(image)
    db.session.commit()

    # A key this app minted for its uploader, and only once no row names it:
    # the same object can be attached in more than one place.
    if not key_still_referenced(object_key):
        remove_key_from_s3(object_key)
    return {"message": "Successfully deleted"}
