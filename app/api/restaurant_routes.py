from flask import Blueprint, jsonify, request, session
from flask_login import login_required, current_user
from app.models import Restaurant, Review, RestaurantImage, User, db
from app.forms import RestaurantForm, RestaurantImageForm

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
    print("!!!!",SingleRestaurant.to_dict())
    theUser=User.query.get(SingleRestaurant.user_id)
    images = RestaurantImage.query.filter(RestaurantImage.restaurant_id==id).all()
    PreviewImage=""
    for image in images:
        if image.preview == True:
            PreviewImage=image

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
@restaurant_routes.route('/', methods=["POST", "GET"])
@login_required
def create_restaurant():

    form = RestaurantForm()
    form["csrf_token"].data = request.cookies["csrf_token"]

    if form.validate_on_submit():
        restaurant = Restaurant(
            user_id = int(current_user.id),
            name = request.get_json()["name"],
            price = request.get_json()["price"],
            address = request.get_json()["address"],
            city = request.get_json()["city"],
            state = request.get_json()["state"],
            zipcode = request.get_json()["zipcode"],
            country = request.get_json()["country"],
            phone_number = request.get_json()["phone_number"],
            website = request.get_json()["website"],
            description = request.get_json()["description"],
        )

        db.session.add(restaurant)
        db.session.commit()

        return restaurant.to_dict()

    else:
        return form.errors


# Add Image to Restaurant by Id
@restaurant_routes.route('/<int:restaurantId>/images', methods=["POST", "GET"])
@login_required
def create_restaurant_image(restaurantId):

    restaurant = Restaurant.query.get(restaurantId)
    if not restaurant:
        return {"errors": ["restaurant couldn't be found"]}, 404

    form = RestaurantImageForm()
    form["csrf_token"].data = request.cookies["csrf_token"]

    if form.validate_on_submit():
        restaurantImage = RestaurantImage(
            restaurant_id = int(restaurantId),
            url = request.get_json()["url"],
            preview = request.get_json()["preview"],
            createdByUserId = current_user.id
        )

        db.session.add(restaurantImage)
        db.session.commit()
        return restaurantImage.to_dict()

    else:
        return form.errors


# Edit a Restaurant by Id
@restaurant_routes.route('/<int:restaurantId>', methods=["PUT", "GET"])
@login_required
def edit_restaurant_by_restaurant_id(restaurantId):
    restaurant = Restaurant.query.get(restaurantId)

    if not restaurant:
        return {"errors": ["restaurant couldn't be found"]}, 404

    form = RestaurantForm()
    form["csrf_token"].data = request.cookies["csrf_token"]

    if form.validate_on_submit():

        restaurant.id=int(restaurantId)
        restaurant.user_id = int(current_user.id)
        restaurant.name = request.get_json()["name"]
        restaurant.price = request.get_json()["price"]
        restaurant.name = request.get_json()["name"]
        restaurant.address = request.get_json()["address"]
        restaurant.city = request.get_json()["city"]
        restaurant.state = request.get_json()["state"]
        restaurant.zipcode = request.get_json()["zipcode"]
        restaurant.country = request.get_json()["country"]
        restaurant.phone_number = request.get_json()["phone_number"]
        restaurant.website = request.get_json()["website"]
        restaurant.description = request.get_json()["description"]

        db.session.commit()
        return restaurant.to_dict()


    else:
        return form.errors


# Delete a Restaurant
@restaurant_routes.route('/<int:restaurantId>', methods=["DELETE"])
@login_required
def delete_restaurant(restaurantId):
    restaurant = Restaurant.query.get(restaurantId)
    if not restaurant:
        return {"errors": ["Restaurant couldn't be found"]}, 404
    db.session.delete(restaurant)
    db.session.commit()
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
