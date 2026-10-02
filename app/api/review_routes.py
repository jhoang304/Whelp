from flask import Blueprint, request
from flask_login import current_user, login_required
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func

from app.models import db, Review, ReviewImage, ReviewResponse
from app.forms import ReviewForm, ReviewImageForm, ReviewResponseForm
from app.api.utils import (
  error_messages, key_still_referenced, read_limit, review_with_details, reviews_with_details)
from app.api.aws_helpers import key_uploaded_by, remove_keys_from_s3

review_routes = Blueprint('reviews', __name__)

ALREADY_ANSWERED = "This review already has a response. Edit the existing response instead."


# The newest reviews, anywhere
@review_routes.route('/recent')
def recent_reviews():
  """
  The newest reviews on the site, each with its author, photos, the
  restaurant it was left on and any reply: the home page's "Recent reviews"
  (#134). Newest is createdAt, then id, as in every review feed.

  `limit` is how many: 6 unless asked, and at most 20.
  """
  limit, error = read_limit(default=6, most=20)
  if error:
    return {"errors": [error]}, 400

  reviews = Review.query.options(
    selectinload(Review.user),
    selectinload(Review.review_images),
    selectinload(Review.response).selectinload(ReviewResponse.user),
    selectinload(Review.restaurant),
  ).order_by(Review.createdAt.desc(), Review.id.desc()).limit(limit).all()
  return {"items": reviews_with_details(reviews)}


# Get one review
@review_routes.route('/<int:id>')
def get_review(id):
  """
  One review, with its author, photos, the restaurant it was left on and any
  business-owner response. The edit page loads it this way, so it works from
  whichever page linked to it -- the restaurant's reviews come a page at a
  time, and the review may not be on the first.

  A user's reviews used to live at this URL; they are GET /api/users/<id>/reviews.
  """
  review = db.session.get(Review, id)
  if not review:
    return {"errors": ["Review couldn't be found"]}, 404
  return review_with_details(review)


# Add an image for a review
@review_routes.route('/<int:id>/images', methods=["POST"])
@login_required
def create_image_by_review_id(id):

  review = db.session.get(Review, id)
  if not review:
    return {"errors": ["Review couldn't be found"]}, 404

  # Before the cap, not after it: this route used to let anyone signed in
  # attach any url to anyone's review, and ten strangers' photos were then
  # also the most the author could ever add.
  if review.user_id != current_user.id:
    return {"errors": ["You can only add photos to your own review"]}, 403

  images = ReviewImage.query.filter(ReviewImage.review_id == id).all()
  if len(images) >= 10:
    return {"errors": ["Maximum number of images for this resource was reached"]}, 403

  form = ReviewImageForm()
  form["csrf_token"].data = request.cookies.get("csrf_token")

  if form.validate_on_submit():
    reviewImage = ReviewImage(
      review_id = id,
      url = form.data["url"],
      s3_key = key_uploaded_by(form.data["url"], current_user.id)
    )
    db.session.add(reviewImage)
    db.session.commit()
    return reviewImage.to_dict()
  return {"errors": error_messages(form.errors)}, 400


# Edit a review
@review_routes.route('/<int:id>', methods=["PUT"])
@login_required
def edit_review(id):

  review = db.session.get(Review, id)

  if not review:
    return {"errors": ["review couldn't be found"]}, 404

  if review.user_id != current_user.id:
    return {"errors": ["You can only edit your own reviews"]}, 403

  form = ReviewForm()
  form["csrf_token"].data = request.cookies.get("csrf_token")

  if form.validate_on_submit():
    review.review = form.data["review"]
    review.rating = form.data["rating"]
    review.updatedAt = func.now()
    db.session.commit()
    return review.to_dict()
  return {"errors": error_messages(form.errors)}, 400


# Delete a review
@review_routes.route('/<int:id>', methods=["DELETE"])
@login_required
def delete_review(id):
  review = db.session.get(Review, id)

  if review is None:
    return {"errors": ["Review couldn't be found"]}, 404

  if review.user_id != current_user.id:
    return {"errors": ["You can only delete your own reviews"]}, 403

  # Read the keys before the delete: the cascade drops the review_images rows,
  # and the objects would otherwise stay in the bucket, public, for good.
  object_keys = [image.s3_key for image in review.review_images if image.s3_key]

  db.session.delete(review)
  db.session.commit()
  # After the commit, so this review's own rows no longer count as references;
  # best effort, like every other cleanup, so a bucket hiccup is not a 500.
  remove_keys_from_s3([key for key in object_keys if not key_still_referenced(key)])

  return {"message": ["Successfully deleted"]},200


# ---------------------------------------------------------------------------
# Business-owner responses
# ---------------------------------------------------------------------------

def _load_review_for_owner(review_id):
  """
  Return (review, None) when the review exists and the current user owns the
  restaurant it was left on; otherwise (None, (json, status)).
  """
  review = db.session.get(Review, review_id)
  if not review:
    return None, ({"errors": ["Review couldn't be found"]}, 404)
  if not review.restaurant or review.restaurant.user_id != current_user.id:
    return None, ({"errors": ["Only the owner of this business can respond to its reviews"]}, 403)
  return review, None


def has_response(review_id):
  """Whether the review has an owner's reply already."""
  return ReviewResponse.query.filter(ReviewResponse.review_id == review_id).first() is not None


# Create an owner response for a review
@review_routes.route('/<int:id>/response', methods=["POST"])
@login_required
def create_review_response(id):
  """
  Lets the owner of the reviewed restaurant post a public reply to a review.
  Each review can have one response.
  """
  review, error = _load_review_for_owner(id)
  if error:
    return error

  if has_response(review.id):
    return {"errors": [ALREADY_ANSWERED]}, 400

  form = ReviewResponseForm()
  form["csrf_token"].data = request.cookies.get("csrf_token")

  if form.validate_on_submit():
    review_id = review.id
    response = ReviewResponse(
      review_id = review_id,
      user_id = current_user.id,
      response = form.data["response"].strip(),
    )
    db.session.add(response)
    try:
      db.session.commit()
    except IntegrityError:
      # Two replies posted at once both pass the check above; the database
      # keeps one, and the other used to be a 500 (#119).
      db.session.rollback()
      if has_response(review_id):
        return {"errors": [ALREADY_ANSWERED]}, 409
      raise
    return response.to_dict(), 201
  return {"errors": error_messages(form.errors)}, 400


# Edit an owner response
@review_routes.route('/<int:id>/response', methods=["PUT"])
@login_required
def update_review_response(id):
  """
  Lets the business owner edit their response to a review.
  """
  review, error = _load_review_for_owner(id)
  if error:
    return error

  if not review.response:
    return {"errors": ["This review doesn't have a response yet"]}, 404

  form = ReviewResponseForm()
  form["csrf_token"].data = request.cookies.get("csrf_token")

  if form.validate_on_submit():
    review.response.response = form.data["response"].strip()
    review.response.updatedAt = func.now()
    db.session.commit()
    return review.response.to_dict()
  return {"errors": error_messages(form.errors)}, 400


# Delete an owner response
@review_routes.route('/<int:id>/response', methods=["DELETE"])
@login_required
def delete_review_response(id):
  """
  Lets the business owner remove their response to a review.
  """
  review, error = _load_review_for_owner(id)
  if error:
    return error

  if not review.response:
    return {"errors": ["This review doesn't have a response yet"]}, 404

  db.session.delete(review.response)
  db.session.commit()
  return {"message": ["Successfully deleted"]}, 200
