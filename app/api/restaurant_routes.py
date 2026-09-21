from flask import Blueprint, request
from flask_login import login_required, current_user
from sqlalchemy.orm import selectinload
from app.models import Restaurant, Review, RestaurantImage, ReviewImage, User, db
from app.api.aws_helpers import key_uploaded_by, remove_keys_from_s3
from app.forms import RestaurantForm, RestaurantImageForm, ReviewForm
from app.api.utils import (
    clear_other_previews, error_messages, key_still_referenced, restaurant_cards,
    reviews_with_details)

restaurant_routes = Blueprint('restaurants', __name__)


# Get all Restaurants
@restaurant_routes.route('/')
def restaurants():
    """Every restaurant, as the cards the listing page shows."""
    return {"Restaurants": restaurant_cards(Restaurant.query.all())}


# Get Single Restaurant by Id
@restaurant_routes.route('/<int:id>')
def restaurants_by_id(id):
    SingleRestaurant = db.session.get(Restaurant, id)
    if not SingleRestaurant:
        return {"errors": ["Restaurant couldn't be found"]}, 404

    theUser=db.session.get(User, SingleRestaurant.user_id)
    images = RestaurantImage.query.filter(RestaurantImage.restaurant_id==id).all()

    reviews=Review.query.filter(Review.restaurant_id==id).all()
    numReviews=len(reviews)


    total_rating=0
    for review in reviews:
        total_rating=total_rating+review.rating
    if numReviews ==0:
        avgStarRating=0
    else:
        avgStarRating=total_rating/numReviews


    data = {
        "id":id,
        "user_id": SingleRestaurant.user_id,
        "name":SingleRestaurant.name,
        "price":SingleRestaurant.price,
        "address" : SingleRestaurant.address,
        "city" : SingleRestaurant.city,
        "state" :SingleRestaurant.state,
        "zipcode": SingleRestaurant.zipcode,
        "country":SingleRestaurant.country,
        "phone_number" : SingleRestaurant.phone_number,
        "description" : SingleRestaurant.description,
        "website":SingleRestaurant.website,
        "User":{
            "id": theUser.id,
            "firstName": theUser.first_name,
            "lastName": theUser.last_name
        },
        "restaurantImages":[{
            "id": image.id,
            "url": image.url,
            "preview": image.preview} for image in images],
       "numReviews": numReviews,
       "avgStarRating": round(avgStarRating,2),
    }

    return data


# Create a Restaurant
@restaurant_routes.route('/', methods=["POST"])
@login_required
def create_restaurant():

    form = RestaurantForm()
    form["csrf_token"].data = request.cookies.get("csrf_token")

    if form.validate_on_submit():
        restaurant = Restaurant(
            user_id = int(current_user.id),
            name = request.get_json()["name"],
            price = request.get_json()["price"],
            address = request.get_json()["address"],
            city = request.get_json()["city"],
            state = request.get_json()["state"],
            # form.data, not the raw JSON: the postcode filter normalises a
            # numeric zipcode to text, and a VARCHAR column will not take an int.
            zipcode = form.data["zipcode"],
            country = request.get_json()["country"],
            phone_number = request.get_json()["phone_number"],
            website = request.get_json()["website"],
            description = request.get_json()["description"],
        )

        db.session.add(restaurant)
        db.session.commit()

        return restaurant.to_dict()

    else:
        return {"errors": error_messages(form.errors)}, 400


# Add Image to Restaurant by Id
@restaurant_routes.route('/<int:restaurantId>/images', methods=["POST"])
@login_required
def create_restaurant_image(restaurantId):

    restaurant = db.session.get(Restaurant, restaurantId)
    if not restaurant:
        return {"errors": ["restaurant couldn't be found"]}, 404

    form = RestaurantImageForm()
    form["csrf_token"].data = request.cookies.get("csrf_token")

    if form.validate_on_submit():
        # Anyone logged in may add a photo, but only the owner decides which
        # one is the cover. Reading `preview` off the form (not the raw JSON)
        # also means a body without the key is a plain photo, not a 500.
        if form.data["preview"] and restaurant.user_id != current_user.id:
            return {"errors": ["Only the business owner can set the cover photo"]}, 403

        restaurantImage = RestaurantImage(
            restaurant_id = int(restaurantId),
            url = form.data["url"],
            # Only an object this caller uploaded gets a key, and only a key is
            # ever deleted. Attaching a stranger's url still works -- it is a
            # link like any other -- but it carries no authority over their
            # object.
            s3_key = key_uploaded_by(form.data["url"], current_user.id),
            preview = form.data["preview"],
            createdByUserId = current_user.id
        )

        if restaurantImage.preview:
            clear_other_previews(restaurantId)

        db.session.add(restaurantImage)
        db.session.commit()
        return restaurantImage.to_dict()

    else:
        return {"errors": error_messages(form.errors)}, 400


# Edit a Restaurant by Id
@restaurant_routes.route('/<int:restaurantId>', methods=["PUT"])
@login_required
def edit_restaurant_by_restaurant_id(restaurantId):
    restaurant = db.session.get(Restaurant, restaurantId)

    if not restaurant:
        return {"errors": ["restaurant couldn't be found"]}, 404

    if restaurant.user_id != current_user.id:
        return {"errors": ["You can only edit your own restaurants"]}, 403

    form = RestaurantForm()
    form["csrf_token"].data = request.cookies.get("csrf_token")

    if form.validate_on_submit():

        restaurant.name = request.get_json()["name"]
        restaurant.price = request.get_json()["price"]
        restaurant.address = request.get_json()["address"]
        restaurant.city = request.get_json()["city"]
        restaurant.state = request.get_json()["state"]
        restaurant.zipcode = form.data["zipcode"]
        restaurant.country = request.get_json()["country"]
        restaurant.phone_number = request.get_json()["phone_number"]
        restaurant.website = request.get_json()["website"]
        restaurant.description = request.get_json()["description"]

        db.session.commit()
        return restaurant.to_dict()


    else:
        return {"errors": error_messages(form.errors)}, 400


# Delete a Restaurant
@restaurant_routes.route('/<int:restaurantId>', methods=["DELETE"])
@login_required
def delete_restaurant(restaurantId):
    restaurant = db.session.get(Restaurant, restaurantId)
    if not restaurant:
        return {"errors": ["Restaurant couldn't be found"]}, 404

    if restaurant.user_id != current_user.id:
        return {"errors": ["You can only delete your own restaurants"]}, 403

    # Read the keys before the delete: the cascade drops the restaurant_images
    # rows, and without this the objects would sit in the bucket forever,
    # costing storage and staying publicly readable after the user deleted them.
    object_keys = [image.s3_key for image in restaurant.restaurant_images if image.s3_key]

    db.session.delete(restaurant)
    db.session.commit()
    # Best effort, like the single-image delete route: a bucket hiccup must
    # not turn a successful delete into a 500. The reference check runs after
    # the commit so this restaurant's own rows are already gone and do not
    # count as references.
    remove_keys_from_s3([key for key in object_keys if not key_still_referenced(key)])
    return {"message": ["Restaurant Successfully deleted"]},200


# Search Restaurants
@restaurant_routes.route("/search/<keyword>")
def search_restaurant(keyword):
    if not keyword or len(keyword.strip()) == 0:
        return {"errors": ["Search keyword cannot be empty"]}, 400
    
    # Sanitize keyword to prevent SQL injection
    sanitized_keyword = keyword.strip()

    # Improved search strategy with prioritization
    if len(sanitized_keyword) < 3:
        # For short keywords (1-2 characters), only search name and city
        queried_restaurants = Restaurant.query.filter(
            db.or_(
                Restaurant.name.ilike(f"%{sanitized_keyword}%"),
                Restaurant.city.ilike(f"%{sanitized_keyword}%")
            )
        ).all()
    else:
        # For longer keywords, search all fields but prioritize exact matches
        # First get exact name matches
        exact_name_matches = Restaurant.query.filter(
            Restaurant.name.ilike(f"%{sanitized_keyword}%")
        ).all()

        # Then get other matches
        other_matches = Restaurant.query.filter(
            db.and_(
                ~Restaurant.name.ilike(f"%{sanitized_keyword}%"),  # Exclude exact name matches
                db.or_(
                    Restaurant.city.ilike(f"%{sanitized_keyword}%"),
                    Restaurant.description.ilike(f"%{sanitized_keyword}%"),
                    Restaurant.state.ilike(f"%{sanitized_keyword}%")
                )
            )
        ).all()

        # Combine results with name matches first
        queried_restaurants = exact_name_matches + other_matches

    return {"Restaurants": restaurant_cards(queried_restaurants)}


# Get reviews by restaurant's id
@restaurant_routes.route('/<int:id>/reviews', methods=['GET'])
def get_reviews_by_restaurant_id(id):
    """
    Returns every review for a restaurant, newest first, including the author,
    review images, and any business-owner response.
    """
    restaurant = db.session.get(Restaurant, id)
    if not restaurant:
        return {"errors": ["restaurant couldn't be found"]}, 404

    reviews = Review.query.options(
        selectinload(Review.user),
        selectinload(Review.review_images),
        selectinload(Review.response),
    ).filter(Review.restaurant_id == id).order_by(Review.createdAt.desc(), Review.id.desc()).all()
    return {"reviews": reviews_with_details(reviews, restaurant=restaurant)}


# Create a review by restaurant's id
@restaurant_routes.route('/<int:id>/reviews', methods=["POST"])
@login_required
def create_review_by_restaurant_id(id):
    restaurant = db.session.get(Restaurant, id)

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
