from flask import Blueprint, request
from flask_login import login_required, current_user
from sqlalchemy import case, or_
from sqlalchemy.orm import selectinload
from app.models import (
    Category, Restaurant, RestaurantHours, Review, RestaurantImage, ReviewImage,
    User, db, restaurant_categories)
from app.api.aws_helpers import key_uploaded_by, remove_keys_from_s3
from app.api.amenities import read_amenities
from app.api.categories import read_categories
from app.api.hours import (
    hours_to_dicts, open_status, read_hours, read_timezone)
from app.api.filters import filtered_restaurants, read_filters
from app.forms import RestaurantForm, RestaurantImageForm, ReviewForm
from app.api.utils import (
    clear_other_previews, error_messages, key_still_referenced, page_response,
    read_page_request, restaurant_cards, reviews_with_details)

restaurant_routes = Blueprint('restaurants', __name__)


def with_details(restaurant):
    """
    One restaurant, its cuisines, what it offers and when it is open, for the
    two routes that write one.

    Not in Restaurant.to_dict: the listing calls that once per card and reads
    every card's categories in a single batched query instead, which a lazy
    relationship on the dict would quietly undo.
    """
    rows = [(row.weekday, row.opens, row.closes) for row in restaurant.hours]
    return {**restaurant.to_dict(),
            "categories": [category.to_dict() for category in restaurant.categories],
            "amenities": [amenity.to_dict() for amenity in restaurant.amenities],
            "hours": hours_to_dicts(sorted(rows)),
            "openStatus": open_status(rows, restaurant.timezone)}


# Get all Restaurants
@restaurant_routes.route('/')
def restaurants():
    """
    A page of restaurants, as the cards the listing page shows.

    `category`, `price` (repeatable), `min_rating` and `city` narrow it, and
    `sort` is rating, reviews or newest. Unsorted it comes back by id, which
    is arbitrary but stable: without an ORDER BY, two pages of the same query
    may repeat a row or skip one entirely.
    """
    page_request = read_page_request()
    if page_request.error:
        return {"errors": [page_request.error]}, 400

    filters = read_filters()
    if filters.error:
        return {"errors": [filters.error]}, 400

    query = filtered_restaurants(filters)
    total = query.count()
    rows = query.limit(page_request.per_page).offset(page_request.offset).all()
    return page_response(restaurant_cards(rows), page_request, total)


# The cities restaurants are actually in
@restaurant_routes.route('/cities')
def cities():
    """
    Every city with a restaurant in it, in one column.

    The city filter matches a whole name, so the filter bar offers this list
    rather than a text box: "Hous" and "Houston, TX" are both reasonable
    things to type and neither of them is a city this database knows.
    """
    rows = db.session.query(Restaurant.city).distinct().order_by(Restaurant.city).all()
    return {"items": [city for (city,) in rows]}


# Get Single Restaurant by Id
@restaurant_routes.route('/<int:id>')
def restaurants_by_id(id):
    SingleRestaurant = db.session.get(Restaurant, id)
    if not SingleRestaurant:
        return {"errors": ["Restaurant couldn't be found"]}, 404

    theUser=db.session.get(User, SingleRestaurant.user_id)
    hour_rows = [(row.weekday, row.opens, row.closes) for row in SingleRestaurant.hours]
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
       "categories": [category.to_dict() for category in SingleRestaurant.categories],
       "amenities": [amenity.to_dict() for amenity in SingleRestaurant.amenities],
       "timezone": SingleRestaurant.timezone,
       "hours": hours_to_dicts(sorted(hour_rows)),
       "openStatus": open_status(hour_rows, SingleRestaurant.timezone),
    }

    return data


# Create a Restaurant
@restaurant_routes.route('/', methods=["POST"])
@login_required
def create_restaurant():

    form = RestaurantForm()
    form["csrf_token"].data = request.cookies.get("csrf_token")

    if form.validate_on_submit():
        # Read before writing anything: a body naming a category that does not
        # exist is a 400, not a restaurant created with one cuisine fewer than
        # the owner chose.
        categories, category_error = read_categories(request.get_json())
        if category_error:
            return {"errors": [category_error]}, 400

        amenities, amenity_error = read_amenities(request.get_json())
        if amenity_error:
            return {"errors": [amenity_error]}, 400

        hours, hours_error = read_hours(request.get_json())
        if hours_error:
            return {"errors": [hours_error]}, 400

        timezone, timezone_error = read_timezone(request.get_json(), form.data["state"])
        if timezone_error:
            return {"errors": [timezone_error]}, 400

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
            timezone = timezone,
        )

        if categories is not None:
            restaurant.categories = categories
        if amenities is not None:
            restaurant.amenities = amenities
        if hours is not None:
            restaurant.hours = [RestaurantHours(weekday=weekday, opens=opens, closes=closes)
                                for weekday, opens, closes in hours]

        db.session.add(restaurant)
        db.session.commit()

        return with_details(restaurant)

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
        categories, category_error = read_categories(request.get_json())
        if category_error:
            return {"errors": [category_error]}, 400

        amenities, amenity_error = read_amenities(request.get_json())
        if amenity_error:
            return {"errors": [amenity_error]}, 400

        hours, hours_error = read_hours(request.get_json())
        if hours_error:
            return {"errors": [hours_error]}, 400

        # A restaurant that has never had one gets the timezone its state
        # suggests; one that has keeps it unless the body says otherwise.
        timezone, timezone_error = read_timezone(
            request.get_json(), form.data["state"])
        if timezone_error:
            return {"errors": [timezone_error]}, 400

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
        # None means the body never mentioned categories, which is what every
        # client written before this feature sends; [] means clear them.
        if categories is not None:
            restaurant.categories = categories
        if amenities is not None:
            restaurant.amenities = amenities
        if hours is not None:
            # Clear and flush before writing the new days. One row per
            # (restaurant, weekday) is a database constraint, and replacing a
            # Tuesday in a single step has SQLAlchemy insert the new one
            # before deleting the old, which the constraint refuses.
            restaurant.hours = []
            db.session.flush()
            restaurant.hours = [RestaurantHours(weekday=weekday, opens=opens, closes=closes)
                                for weekday, opens, closes in hours]
        if timezone is not None:
            restaurant.timezone = timezone

        db.session.commit()
        return with_details(restaurant)


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
    """
    A page of the restaurants matching `keyword`, name matches first, then
    cuisines, then a mention anywhere else.

    Takes the same filters and sort as the listing. The whole thing is one
    query: it used to load every match into Python and slice the list, so a
    search on a real table read the table to show twenty rows.
    """
    if not keyword or len(keyword.strip()) == 0:
        return {"errors": ["Search keyword cannot be empty"]}, 400

    page_request = read_page_request()
    if page_request.error:
        return {"errors": [page_request.error]}, 400

    filters = read_filters()
    if filters.error:
        return {"errors": [filters.error]}, 400

    sanitized_keyword = keyword.strip()
    pattern = f"%{sanitized_keyword}%"
    name_match = Restaurant.name.ilike(pattern)
    # "Italian" is what people type into a search box, and this page used to
    # invite it while nothing recorded what a restaurant served -- so it found
    # only the owners who had written the word into their description.
    category_match = Restaurant.id.in_(
        db.session.query(restaurant_categories.c.restaurant_id).join(
            Category, Category.id == restaurant_categories.c.category_id
        ).filter(Category.name.ilike(pattern))
    )

    if len(sanitized_keyword) < 3:
        # One or two characters match too much of a description to be useful.
        matches = or_(name_match, Restaurant.city.ilike(pattern))
        relevance = case((name_match, 0), else_=1)
    else:
        matches = or_(
            name_match,
            category_match,
            Restaurant.city.ilike(pattern),
            Restaurant.description.ilike(pattern),
            Restaurant.state.ilike(pattern),
        )
        # A restaurant named for the word beats one that serves it, which
        # beats one that merely mentions it somewhere.
        relevance = case((name_match, 0), (category_match, 1), else_=2)

    query = filtered_restaurants(
        filters,
        base=Restaurant.query.filter(matches),
        relevance=relevance,
    )

    total = query.count()
    rows = query.limit(page_request.per_page).offset(page_request.offset).all()
    return page_response(restaurant_cards(rows), page_request, total)


REVIEW_ORDERS = {
    "newest": (Review.createdAt.desc(), Review.id.desc()),
    "highest": (Review.rating.desc(), Review.createdAt.desc(), Review.id.desc()),
    "lowest": (Review.rating.asc(), Review.createdAt.desc(), Review.id.desc()),
}


# Get reviews by restaurant's id
@restaurant_routes.route('/<int:id>/reviews', methods=['GET'])
def get_reviews_by_restaurant_id(id):
    """
    A page of a restaurant's reviews, with the author, review images, and any
    business-owner response.

    `sort` is newest, highest or lowest; every order ends in createdAt and id
    so equal ratings still come back in one settled order across pages.
    """
    restaurant = db.session.get(Restaurant, id)
    if not restaurant:
        return {"errors": ["restaurant couldn't be found"]}, 404

    sort = request.args.get("sort", "newest")
    if sort not in REVIEW_ORDERS:
        return {"errors": [f"sort must be one of: {', '.join(REVIEW_ORDERS)}"]}, 400

    page_request = read_page_request()
    if page_request.error:
        return {"errors": [page_request.error]}, 400

    query = Review.query.options(
        selectinload(Review.user),
        selectinload(Review.review_images),
        selectinload(Review.response),
    ).filter(Review.restaurant_id == id).order_by(*REVIEW_ORDERS[sort])

    total = query.count()
    reviews = query.limit(page_request.per_page).offset(page_request.offset).all()
    return page_response(reviews_with_details(reviews, restaurant=restaurant),
                         page_request, total)


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
