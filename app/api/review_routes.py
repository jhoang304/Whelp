from flask import Blueprint, request
from flask_login import current_user, login_required
from sqlalchemy.sql import func

from app.models import db, Review, Restaurant, RestaurantImage, User, ReviewImage, ReviewResponse
from app.forms import ReviewForm, ReviewImageForm, ReviewResponseForm
from app.api.utils import error_messages
from .restaurant_routes import restaurant_routes

review_routes = Blueprint('reviews', __name__)


def _preview_image_url(restaurant_id):
  image = RestaurantImage.query.filter(
    RestaurantImage.restaurant_id == restaurant_id,
    RestaurantImage.preview == True
  ).first()
  return image.url if image else None


def review_with_details(review, restaurant=None):
  """Serialize a review with its author, images, restaurant, and owner response."""
  restaurant = restaurant or review.restaurant
  data = review.to_dict()
  data["user"] = review.user.to_dict_public() if review.user else None
  data["reviewImages"] = [image.to_dict() for image in review.review_images]
  if restaurant:
    restaurant_data = restaurant.to_dict()
    restaurant_data["previewImage"] = _preview_image_url(restaurant.id)
    data["restaurant"] = restaurant_data
  else:
    data["restaurant"] = None
  data["response"] = review.response.to_dict() if review.response else None
  return data


# get all reviews by user id
@review_routes.route('/<int:id>')
def get_reviews_by_userId(id):
  """
  Returns every review written by a user, newest first, including the
  restaurant it was left on and any business-owner response.
  """
  reviews = Review.query.filter(Review.user_id == id).order_by(Review.createdAt.desc(), Review.id.desc()).all()
  return [review_with_details(review) for review in reviews]


# Get reviews by restaurant's id
@restaurant_routes.route('/<int:id>/reviews', methods=['GET'])
def get_reviews_by_restaurant_id(id):
  """
  Returns every review for a restaurant, newest first, including the author,
  review images, and any business-owner response.
  """
  restaurant = Restaurant.query.get(id)
  if not restaurant:
    return {"errors": ["restaurant couldn't be found"]}, 404

  reviews = Review.query.filter(Review.restaurant_id == id).order_by(Review.createdAt.desc(), Review.id.desc()).all()
  return {"reviews": [review_with_details(review, restaurant=restaurant) for review in reviews]}


# Add an image for a review
@review_routes.route('/<int:id>/images', methods=["POST", 'GET'])
@login_required
def create_image_by_review_id(id):

  review = Review.query.get(id)
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
      url = form.data["url"]
    )
    db.session.add(reviewImage)
    db.session.commit()
    return reviewImage.to_dict()
  return {"errors": error_messages(form.errors)}, 400


## Create a review by restaurant's id
@restaurant_routes.route('/<int:id>/reviews', methods=["POST", "GET"])
@login_required
def create_review_by_restaurant_id(id):
  restaurant = Restaurant.query.get(id)

  if not restaurant:
    return {"errors": ["restaurant couldn't be found"]}, 404

  if restaurant.user_id == current_user.id:
    return {"errors": ["User can't add review on his own restaurant"]}, 403

  review = Review.query.filter(Review.restaurant_id == id, Review.user_id == current_user.id).all()

  if len(review) > 0:
    return {"errors": ["User already has a review for this restaurant"]}, 403

  form = ReviewForm()
  form["csrf_token"].data = request.cookies.get("csrf_token")

  if form.validate_on_submit():
    review = Review(
      user_id = int(current_user.id),
      restaurant_id = id,
      review = form.data["review"],
      rating = form.data["rating"],
    )

    db.session.add(review)
    db.session.commit()
    return review.to_dict()
  return {"errors": error_messages(form.errors)}, 400


# Edit a review
@review_routes.route('/<int:id>', methods=["PUT", "GET"])
@login_required
def edit_review(id):

  review = Review.query.get(id)

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
  review = Review.query.get(id)

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
  review = Review.query.get(review_id)
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
