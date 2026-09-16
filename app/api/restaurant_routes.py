from flask import Blueprint, request
from flask_login import login_required, current_user
from app.models import Restaurant, Review, RestaurantImage, ReviewImage, User, db
from app.api.aws_helpers import remove_files_from_s3
from app.forms import RestaurantForm, RestaurantImageForm, ReviewForm
from app.api.utils import clear_other_previews, error_messages, review_with_details

restaurant_routes = Blueprint('restaurants', __name__)


# Get all Restaurants
@restaurant_routes.route('/')
def restaurants():
    restaurants = Restaurant.query.all()
    reviews=Review.query.all()
    restaurant_images= RestaurantImage.query.all()


    for restaurant in restaurants:
        restaurants_reviews = Review.query.filter(
            Review.restaurant_id == restaurant.id).all()
        if len(restaurants_reviews)==0:
            restaurant.aveRating=0
        rating = 0
        review_count = 0
        for review in restaurants_reviews:

            review_count=review_count+1
            rating=rating+review.rating


            aveRating=rating/review_count
            restaurant.aveRating=aveRating


    for restaurant in restaurants:
        restaurant.preview= None
        for image in restaurant_images:
            if image.restaurant_id == restaurant.id and image.preview == True:
                restaurant.preview=image.url

    for restaurant in restaurants:
        restaurant.oneReview= None
        for review in reviews:
            if review.restaurant_id == restaurant.id:
                restaurant.oneReview=review.review


    data = {
        "Restaurants":[{
        "id":restaurant.id,
        "user_id": restaurant.user_id,
        "name":restaurant.name,
        "price":restaurant.price,
        "address" : restaurant.address,
        "city" : restaurant.city,
        "state" :restaurant.state,
        "zipcode": restaurant.zipcode,
        "country":restaurant.country,
        "phone_number" : restaurant.phone_number,
        "description" : restaurant.description,
        "website":restaurant.website,
        "avgRating": round(restaurant.aveRating,2),
        "previewImage": restaurant.preview,
        "oneReview":restaurant.oneReview
    } for restaurant in restaurants]}

    return data


# Get Single Restaurant by Id
@restaurant_routes.route('/<int:id>')
def restaurants_by_id(id):
    SingleRestaurant = Restaurant.query.get(id)
    if not SingleRestaurant:
        return {"errors": ["Restaurant couldn't be found"]}, 404

    theUser=User.query.get(SingleRestaurant.user_id)
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
        return {"errors": form.errors}, 400


# Add Image to Restaurant by Id
@restaurant_routes.route('/<int:restaurantId>/images', methods=["POST"])
@login_required
def create_restaurant_image(restaurantId):

    restaurant = Restaurant.query.get(restaurantId)
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
    restaurant = Restaurant.query.get(restaurantId)

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


def _still_referenced(image_url):
    """
    True when some remaining row still points at this object.

    An image row carries a URL the caller typed, not a key this app minted, so
    two rows can name the same object. Deleting it on behalf of one of them
    would break the other's page — and because the attach route accepts any
    URL, that is also how someone could aim this cleanup at a photo they do
    not own.

    This narrows that window; it does not close it. Nothing stops a row
    naming the same URL from being inserted between this check and the
    DeleteObjects call, and there is no row to lock against an insert that has
    not happened yet — closing it properly would mean serialising every image
    attach against every cleanup on the URL itself. The fix is to stop deriving
    deletion authority from a caller-supplied URL at all: see issue #58, which
    gives uploads an app-controlled key owned by exactly one row, and with it
    this question stops being asked.
    """
    if RestaurantImage.query.filter(RestaurantImage.url == image_url).first():
        return True
    return ReviewImage.query.filter(ReviewImage.url == image_url).first() is not None


# Delete a Restaurant
@restaurant_routes.route('/<int:restaurantId>', methods=["DELETE"])
@login_required
def delete_restaurant(restaurantId):
    restaurant = Restaurant.query.get(restaurantId)
    if not restaurant:
        return {"errors": ["Restaurant couldn't be found"]}, 404

    if restaurant.user_id != current_user.id:
        return {"errors": ["You can only delete your own restaurants"]}, 403

    # Read the URLs before the delete: the cascade drops the restaurant_images
    # rows, and without this the objects would sit in the bucket forever,
    # costing storage and staying publicly readable after the user deleted them.
    image_urls = [image.url for image in restaurant.restaurant_images]

    db.session.delete(restaurant)
    db.session.commit()
    # Best effort, like the single-image delete route: a bucket hiccup must
    # not turn a successful delete into a 500. The reference check runs after
    # the commit so this restaurant's own rows are already gone and do not
    # count as references.
    remove_files_from_s3([url for url in image_urls if not _still_referenced(url)])
    return {"message": ["Restaurant Successfully deleted"]},200


# Search Restaurants
@restaurant_routes.route("/search/<keyword>")
def search_restaurant(keyword):
    if not keyword or len(keyword.strip()) == 0:
        return {"Restaurants": []}, 400
    
    # Sanitize keyword to prevent SQL injection
    sanitized_keyword = keyword.strip()
    
    restaurant_images = RestaurantImage.query.all()
    reviews = Review.query.all()

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

    # Calculate average ratings and add preview images
    for restaurant in queried_restaurants:
        # Add preview image
        restaurant.preview = None
        for image in restaurant_images:
            if image.restaurant_id == restaurant.id and image.preview == True:
                restaurant.preview = image.url

        # Calculate average rating
        restaurant_reviews = [review for review in reviews if review.restaurant_id == restaurant.id]
        if len(restaurant_reviews) == 0:
            restaurant.aveRating = 0
            restaurant.numReviews = 0
        else:
            total_rating = sum(review.rating for review in restaurant_reviews)
            restaurant.aveRating = total_rating / len(restaurant_reviews)
            restaurant.numReviews = len(restaurant_reviews)

        # Add one sample review
        restaurant.oneReview = restaurant_reviews[0].review if restaurant_reviews else None

    data = {
        "Restaurants": [{
            "id": restaurant.id,
            "user_id": restaurant.user_id,
            "name": restaurant.name,
            "price": restaurant.price,
            "address": restaurant.address,
            "city": restaurant.city,
            "state": restaurant.state,
            "zipcode": restaurant.zipcode,
            "country": restaurant.country,
            "phone_number": restaurant.phone_number,
            "description": restaurant.description,
            "website": restaurant.website,
            "avgRating": round(restaurant.aveRating, 2),
            "numReviews": restaurant.numReviews,
            "previewImage": restaurant.preview,
            "oneReview": restaurant.oneReview
        } for restaurant in queried_restaurants],
    }

    return data


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


# Create a review by restaurant's id
@restaurant_routes.route('/<int:id>/reviews', methods=["POST"])
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
