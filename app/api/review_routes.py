from flask import Blueprint, request
from flask_login import current_user, login_required
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func

from app.models import db, Review, ReviewImage, ReviewResponse
from app.forms import ReviewForm, ReviewImageForm, ReviewResponseForm
from app.api.utils import error_messages, reviews_with_details
from app.api.aws_helpers import key_uploaded_by

review_routes = Blueprint('reviews', __name__)


# get all reviews by user id
@review_routes.route('/<int:id>')
def get_reviews_by_userId(id):
  """
  Returns every review written by a user, newest first, including the
  restaurant it was left on and any business-owner response.
  """
  reviews = Review.query.options(
    selectinload(Review.user),
    selectinload(Review.review_images),
    selectinload(Review.response),
    selectinload(Review.restaurant),
  ).filter(Review.user_id == id).order_by(Review.createdAt.desc(), Review.id.desc()).all()
  return reviews_with_details(reviews)


# Add an image for a review
@review_routes.route('/<int:id>/images', methods=["POST"])
@login_required
def create_image_by_review_id(id):

  review = db.session.get(Review, id)
  if not review:
    return {"errors": ["Review couldn't be found"]}, 404

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

  db.session.delete(review)
  db.session.commit()

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

  if review.response:
    return {"errors": ["This review already has a response. Edit the existing response instead."]}, 400

  form = ReviewResponseForm()
  form["csrf_token"].data = request.cookies.get("csrf_token")

  if form.validate_on_submit():
    response = ReviewResponse(
      review_id = review.id,
      user_id = current_user.id,
      response = form.data["response"].strip(),
    )
    db.session.add(response)
    db.session.commit()
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
