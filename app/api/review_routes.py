from flask import Blueprint, request
from flask_login import current_user, login_required
from app.models import db,Review, Restaurant, User, ReviewImage
from .restaurant_routes import restaurant_routes
from app.forms import ReviewForm, ReviewImageForm
from sqlalchemy.sql import func

review_routes = Blueprint('reviews', __name__)

# get all reviews by user id
@review_routes.route('/<int:id>')
def get_reviews_by_userId(id):
  reviews = Review.query.filter(Review.user_id == id).all()
  data =[]
  for review in reviews:
    restaurants = Restaurant.query.filter(Restaurant.id == review.restaurant_id)
    oneReviewInfor = {}
    oneReviewInfor["restaurant"] = restaurants[0].to_dict()
    oneReviewInfor.update(review.to_dict())
    data.append(oneReviewInfor)
  return data

# Get reviews by restaurant's id
@restaurant_routes.route('/<int:id>/reviews', methods=['GET'])
def get_reviews_by_restaurant_id(id):
  restaurant = Restaurant.query.get(id)
  if not restaurant:
    return {"errors": ["restaurant couldn't be found"]}, 404

  reviews = Review.query.filter(Review.restaurant_id == id).all()

  data = []
  for review in reviews:
    user = User.query.get(review.user_id)

    reviewImage = ReviewImage.query.filter(ReviewImage.review_id == review.id).all()
    oneReviewInfo = {}
    oneReviewInfo["user"] = user.to_dict()
    oneReviewInfo["reviewImages"] = [image.to_dict() for image in reviewImage]
    oneReviewInfo["restaurant"] = restaurant.to_dict()
    oneReviewInfo.update(review.to_dict())
    data.append(oneReviewInfo)

  return {"reviews" : data}


# Add an image for a review
@review_routes.route('/<int:id>/images', methods=["POST",'GET'])
@login_required
def create_image_by_review_id(id):

  review = Review.query.get(id)
  if not review:
    return {"error": ["Review couldn't be found"]}, 404

  images = ReviewImage.query.filter(ReviewImage.review_id == id).all()
  if len(images)>=10:
    return {"message": ["Maximum number of images for this resource was reached"]}, 403

  form = ReviewImageForm()
  form["csrf_token"].data = request.cookies["csrf_token"]

  if form.validate_on_submit():
    reviewImage = ReviewImage(
      review_id = id,
      url = request.get_json()["url"]
    )
    db.session.add(reviewImage)
    db.session.commit()
    return reviewImage.to_dict()
  elif form.errors:
    return form.errors



## Create a review by restaurant's id
@restaurant_routes.route('/<int:id>/reviews', methods=["POST", "GET"])
@login_required
def create_review_by_restaurant_id(id):
  restaurant = Restaurant.query.get(id)

  if (restaurant.user_id == current_user.id):
    return {"errors": ["User can't add review on his own restaurant"]}, 403

  if not restaurant:
    return {"errors": ["restaurant couldn't be found"]}, 404

  review = Review.query.filter(Review.restaurant_id == id, Review.user_id == current_user.id).all()

  if len(review) > 0:
    return {"errors": ["User already has a review for this restaurant"]}, 403

  form = ReviewForm()
  form["csrf_token"].data = request.cookies["csrf_token"]

  if form.validate_on_submit():
    review = Review(
      user_id = int(current_user.id),
      restaurant_id = id,
      review = request.get_json()["review"],
      rating = request.get_json()["rating"],
    )

    db.session.add(review)
    db.session.commit()
    return review.to_dict()
  if form.errors:
    return {"errors": {"review": "Review text is required",
    "rating": "Rating must be an integer from 1 to 5",}}, 400



# Edit a review
@review_routes.route('/<int:id>', methods=["PUT", "GET"])
@login_required
def create_review_by_restaurant_id(id):

  review = Review.query.get(id)

  if not review:
    return {"errors": ["review couldn't be found"]}, 404

  form = ReviewForm()
  form["csrf_token"].data = request.cookies["csrf_token"]

  if form.validate_on_submit():
    review.review = request.get_json()["review"]
    review.rating = request.get_json()["rating"]
    review.updatedAt = func.now()
    db.session.commit()
    return review.to_dict()
  elif form.errors:
    return {"errors": {"review": "Review text is required",
    "stars": "Stars must be an integer from 1 to 5",}}, 400


# Delete a review
@review_routes.route('/<int:id>', methods=["DELETE"])
@login_required
def delete_review(id):
  review = Review.query.get(id)

  if review is None:
    return {"errors": ["Review couldn't be found"]}, 404

  db.session.delete(review)
  db.session.commit()

  return {"message": ["Successfully deleted"]},200
