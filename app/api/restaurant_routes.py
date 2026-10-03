from flask import Blueprint, request
from flask_login import login_required, current_user
from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from app.models import (
    Favorite, Restaurant, RestaurantHours, Review, RestaurantImage, ReviewImage, User, db)
from app.api import demo
from app.api.demo import is_demo_restaurant
from app.api.aws_helpers import key_uploaded_by, remove_keys_from_s3
from app.api.amenities import read_amenities
from app.api.categories import read_categories
from app.api.hours import (
    hours_to_dicts, open_status, read_hours, read_timezone, read_timezone_change)
from app.api.filters import filtered_restaurants, read_filters
from app.api.search import keyword_match
from app.forms import RestaurantForm, RestaurantImageForm, ReviewForm
from app.api.utils import (
    clear_other_previews, error_messages, favorited_ids, key_still_referenced, page_response,
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
            "isDemoRestaurant": is_demo_restaurant(restaurant),
            "categories": [category.to_dict() for category in restaurant.categories],
            "amenities": [amenity.to_dict() for amenity in restaurant.amenities],
            "hours": hours_to_dicts(sorted(rows)),
            "openStatus": open_status(rows, restaurant.timezone)}


def read_cover():
    """
    The cover photo a new restaurant is created with, from `url` in the body:
    (url, None), (None, None) when none was sent, or (None, messages).

    Checked by the form every other photo is, so a cover is held to the same
    length and scheme as one added later.
    """
    body = request.get_json(silent=True) or {}
    if body.get("url") in (None, ""):
        return None, None
    cover_form = RestaurantImageForm()
    cover_form["csrf_token"].data = request.cookies.get("csrf_token")
    if not cover_form.validate():
        return None, error_messages(cover_form.errors)
    return cover_form.data["url"], None


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


def one_spelling_per_city(rows):
    """
    [(city, restaurants)] as a sorted list with one spelling per city.

    Cities are the same when they match trimmed and in any case. The spelling
    shown is the one the most restaurants use, and a tie goes to the one in
    title case, then to the first alphabetically -- so the answer is the same
    every time.
    """
    spellings = {}
    for city, count in rows:
        if not city or not city.strip():
            continue
        spelling = city.strip()
        counts = spellings.setdefault(spelling.lower(), {})
        counts[spelling] = counts.get(spelling, 0) + count

    def best(counts):
        return min(counts, key=lambda spelling: (-counts[spelling], spelling != spelling.title(), spelling))

    return sorted((best(counts) for counts in spellings.values()), key=str.lower)


# The cities restaurants are actually in
@restaurant_routes.route('/cities')
def cities():
    """
    Every city with a restaurant in it, once each.

    The city filter matches a whole name, so the filter bar offers this list
    rather than a text box: "Hous" and "Houston, TX" are both reasonable
    things to type and neither of them is a city this database knows.

    Spellings that differ only in case or the spaces around them are one
    city, as the filter treats them (#128): "HOUSTON", "Houston", "Houston "
    and "houston" were four entries. Each is shown as its commonest spelling.
    """
    rows = db.session.query(Restaurant.city, func.count(Restaurant.id)).group_by(Restaurant.city).all()
    return {"items": one_spelling_per_city(rows)}


# Get Single Restaurant by Id
@restaurant_routes.route('/<int:id>')
def restaurants_by_id(id):
    SingleRestaurant = db.session.get(Restaurant, id)
    if not SingleRestaurant:
        return {"errors": ["Restaurant couldn't be found"]}, 404

    theUser=db.session.get(User, SingleRestaurant.user_id)
    hour_rows = [(row.weekday, row.opens, row.closes) for row in SingleRestaurant.hours]
    # In id order: without one the database's own, which can change (#129).
    images = RestaurantImage.query.filter(RestaurantImage.restaurant_id==id).order_by(RestaurantImage.id).all()

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
       "isFavorited": id in favorited_ids([id]),
       # One of the shared demo account's restaurants, which can't be deleted
       # or renamed: the page leaves out what the API would refuse (#136).
       "isDemoRestaurant": is_demo_restaurant(SingleRestaurant),
       # The reader's own review of this restaurant, if they have written one:
       # the page it is on is not something the first page of reviews can
       # answer, and "Write a review" should send them to it instead.
       "viewerReviewId": next((review.id for review in reviews
                               if current_user.is_authenticated and review.user_id == current_user.id), None),
    }

    return data


# Save a restaurant, or stop saving it
@restaurant_routes.route('/<int:id>/favorite', methods=['POST', 'DELETE'])
@login_required
def favorite_restaurant(id):
    """
    POST saves the restaurant to the reader's list; DELETE takes it off.

    Both say where things now stand, as {"isFavorited": bool}, and both are
    safe to repeat: saving something already saved, or unsaving something
    that never was, is not an error. The heart is a toggle, and a double
    click or a retried request should land it where it was aimed, not
    answer with a 409 the page then has to explain.
    """
    if not db.session.get(Restaurant, id):
        return {"errors": ["Restaurant couldn't be found"]}, 404

    existing = Favorite.query.filter_by(user_id=current_user.id, restaurant_id=id).first()

    if request.method == 'DELETE':
        if existing:
            db.session.delete(existing)
            db.session.commit()
        return {"isFavorited": False}

    if existing:
        return {"isFavorited": True}
    db.session.add(Favorite(user_id=current_user.id, restaurant_id=id))
    try:
        db.session.commit()
    except IntegrityError:
        # Two saves racing each other: the other one got there first, and
        # the unique constraint turned this one away. Either way, it is saved.
        db.session.rollback()
    return {"isFavorited": True}, 201


# Create a Restaurant
@restaurant_routes.route('/', methods=["POST"])
@login_required
def create_restaurant():
    """
    Create a restaurant owned by the caller, with its cuisines, amenities,
    hours and, from `url`, its cover photo.

    One request and one commit. The cover used to be a second request after
    this one had committed, so a cover that failed left a restaurant behind
    and the form, still open, made another on every retry (#114). Now a
    cover the form refuses is a 400 and nothing is created.
    """
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

        cover_url, cover_errors = read_cover()
        if cover_errors:
            return {"errors": cover_errors}, 400

        restaurant = Restaurant(
            user_id = int(current_user.id),
            # form.data, not the raw JSON, for every field: the form checked
            # these values (and turned a numeric zipcode into text). The raw
            # JSON could still hold a list the form had read only the first
            # element of, and a list reached the INSERT as a 500 (#111).
            name = form.data["name"],
            price = form.data["price"],
            address = form.data["address"],
            city = form.data["city"],
            state = form.data["state"],
            zipcode = form.data["zipcode"],
            country = form.data["country"],
            phone_number = form.data["phone_number"],
            website = form.data["website"],
            description = form.data["description"],
            timezone = timezone,
        )

        if categories is not None:
            restaurant.categories = categories
        if amenities is not None:
            restaurant.amenities = amenities
        if hours is not None:
            restaurant.hours = [RestaurantHours(weekday=weekday, opens=opens, closes=closes)
                                for weekday, opens, closes in hours]
        if cover_url:
            restaurant.restaurant_images = [RestaurantImage(
                url=cover_url,
                # As on any photo: only an object this caller uploaded gets a
                # key, and only a key is ever deleted.
                s3_key=key_uploaded_by(cover_url, current_user.id),
                preview=True,
                createdByUserId=current_user.id,
            )]

        db.session.add(restaurant)
        db.session.commit()

        return {**with_details(restaurant), "previewImage": cover_url}

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
        # Its name is how the demo reset finds it again (#136).
        if is_demo_restaurant(restaurant) and form.data["name"] != restaurant.name:
            return {"errors": [demo.RENAME_RESTAURANT]}, 403

        categories, category_error = read_categories(request.get_json())
        if category_error:
            return {"errors": [category_error]}, 400

        amenities, amenity_error = read_amenities(request.get_json())
        if amenity_error:
            return {"errors": [amenity_error]}, 400

        hours, hours_error = read_hours(request.get_json())
        if hours_error:
            return {"errors": [hours_error]}, 400

        # Read before the state is overwritten below: a move to another
        # state is one of the times the zone is guessed again.
        timezone, timezone_error = read_timezone_change(
            request.get_json(), restaurant.timezone, restaurant.state, form.data["state"])
        if timezone_error:
            return {"errors": [timezone_error]}, 400

        restaurant.name = form.data["name"]
        restaurant.price = form.data["price"]
        restaurant.address = form.data["address"]
        restaurant.city = form.data["city"]
        restaurant.state = form.data["state"]
        restaurant.zipcode = form.data["zipcode"]
        restaurant.country = form.data["country"]
        restaurant.phone_number = form.data["phone_number"]
        restaurant.website = form.data["website"]
        restaurant.description = form.data["description"]
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

    # It would take every other visitor's demo with it, and the reviews,
    # replies and photos other people left there (#136).
    if is_demo_restaurant(restaurant):
        return {"errors": [demo.DELETE_RESTAURANT]}, 403

    # Read the keys before the delete: the cascade drops the restaurant_images
    # rows, and without this the objects would sit in the bucket forever,
    # costing storage and staying publicly readable after the user deleted them.
    object_keys = [image.s3_key for image in restaurant.restaurant_images if image.s3_key]
    # The cascade reaches one level further: the restaurant's reviews go, and
    # their photos with them. Collecting only the restaurant's own images left
    # every review photo's object behind in the bucket.
    object_keys += [key for (key,) in db.session.query(ReviewImage.s3_key).join(
        Review, Review.id == ReviewImage.review_id
    ).filter(
        Review.restaurant_id == restaurantId, ReviewImage.s3_key.isnot(None)
    ).all()]

    db.session.delete(restaurant)
    db.session.commit()
    # Best effort, like the single-image delete route: a bucket hiccup must
    # not turn a successful delete into a 500. The reference check runs after
    # the commit so this restaurant's own rows are already gone and do not
    # count as references.
    remove_keys_from_s3([key for key in object_keys if not key_still_referenced(key)])
    return {"message": ["Restaurant Successfully deleted"]},200


# Search Restaurants
@restaurant_routes.route("/search")
def search_restaurants_by_query():
    """
    GET /api/restaurants/search?q=... -- the keyword as a query parameter.

    In the path it could not hold a "/": the server decodes %2F before
    routing, so "24/7 Diner" was a 404 (#108). A query string is decoded
    once and carries anything.
    """
    return search_restaurant(request.args.get("q", ""))


# The keyword-in-the-path form, kept for a browser still running the
# previous bundle while a deploy lands. Nothing in the current app calls it.
@restaurant_routes.route("/search/<keyword>")
def search_restaurant(keyword):
    """
    A page of the restaurants matching every word of `keyword` -- in the
    name, city, cuisines, description or state -- named for it first, then
    serving it, then mentioning it anywhere else.

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

    # Every word matching some field, not the whole query inside one: see
    # app/api/search.py (#118).
    matches, relevance = keyword_match(keyword)

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

    `mine=first` puts the signed-in reader's own review at the head of the
    list in every order, which is where the restaurant page shows it (#113).
    Its place is then fixed, so paging past it by offset stays consistent.
    """
    restaurant = db.session.get(Restaurant, id)
    if not restaurant:
        return {"errors": ["restaurant couldn't be found"]}, 404

    sort = request.args.get("sort", "newest")
    if sort not in REVIEW_ORDERS:
        return {"errors": [f"sort must be one of: {', '.join(REVIEW_ORDERS)}"]}, 400

    mine = request.args.get("mine", "")
    if mine not in ("", "first"):
        return {"errors": ["mine can only be first"]}, 400
    order = REVIEW_ORDERS[sort]
    if mine == "first" and current_user.is_authenticated:
        order = (case((Review.user_id == current_user.id, 0), else_=1), *order)

    page_request = read_page_request()
    if page_request.error:
        return {"errors": [page_request.error]}, 400

    query = Review.query.options(
        selectinload(Review.user),
        selectinload(Review.review_images),
        selectinload(Review.response),
    ).filter(Review.restaurant_id == id).order_by(*order)

    total = query.count()
    reviews = query.limit(page_request.per_page).offset(page_request.offset).all()
    return page_response(reviews_with_details(reviews, restaurant=restaurant),
                         page_request, total)


def has_reviewed(user_id, restaurant_id):
    """Whether this person has a review of this restaurant already."""
    return Review.query.filter(Review.restaurant_id == restaurant_id,
                               Review.user_id == user_id).first() is not None


# Create a review by restaurant's id
@restaurant_routes.route('/<int:id>/reviews', methods=["POST"])
@login_required
def create_review_by_restaurant_id(id):
    restaurant = db.session.get(Restaurant, id)

    if not restaurant:
        return {"errors": ["restaurant couldn't be found"]}, 404

    if restaurant.user_id == current_user.id:
        return {"errors": ["You can't review your own restaurant"]}, 403

    user_id = current_user.id
    if has_reviewed(user_id, id):
        return {"errors": ["You've already reviewed this restaurant"]}, 403

    form = ReviewForm()
    form["csrf_token"].data = request.cookies.get("csrf_token")

    if form.validate_on_submit():
        review = Review(
            user_id = user_id,
            restaurant_id = id,
            review = form.data["review"],
            rating = form.data["rating"],
        )

        db.session.add(review)
        try:
            db.session.commit()
        except IntegrityError:
            # Two requests close together -- a double click, a retry, two
            # tabs -- can both pass the check above, and the database lets
            # only one in (#119). The other is told what the check would
            # have said, rather than "Something went wrong".
            db.session.rollback()
            if has_reviewed(user_id, id):
                return {"errors": ["You've already reviewed this restaurant"]}, 409
            raise
        return review.to_dict()
    return {"errors": error_messages(form.errors)}, 400
