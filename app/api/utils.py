from sqlalchemy import func


def error_messages(form_errors):
    """
    Flatten WTForms' {field: [messages]} into a plain list of messages.

    Every failing response in this API answers {"errors": [message, ...]} -- a
    flat list of strings a UI can render as-is, with the status code carrying
    what kind of failure it was. Route the form errors through here rather
    than handing back form.errors, whose shape is WTForms' business, and write
    messages that name their own field, since nothing else will.
    """
    messages = []
    for field in form_errors:
        for error in form_errors[field]:
            messages.append(error)
    return messages


def lock_restaurant(restaurant_id):
    """
    Take a row lock on the restaurant so its photo changes serialise.

    Every route that adds, promotes or removes one of a restaurant's images
    must call this *before* reading the rows it is going to act on, and hold it
    until commit. Locking only the cover-changing paths is not enough: deleting
    the cover promotes the oldest remaining photo, and a plain delete of that
    photo — which changes no cover itself — is exactly what must not interleave.

    Postgres blocks the second caller here until the first commits. SQLite
    ignores FOR UPDATE, which is fine for the single-connection test suite.
    """
    from app.models import Restaurant

    Restaurant.query.filter(Restaurant.id == restaurant_id).with_for_update().first()


def clear_other_previews(restaurant_id, keep_image_id=None):
    """
    Drop `preview` from a restaurant's other images so at most one row is its
    cover photo. Call it inside the transaction that sets the new preview;
    it stages the changes and leaves the commit to the caller.

    Takes the restaurant lock: without it, two cover changes racing on the same
    restaurant would both read the old cover, both demote it, and both commit a
    preview=True row, leaving the listing to pick whichever iterated last.
    Re-taking a lock the caller already holds is free within one transaction.
    """
    from app.models import RestaurantImage

    lock_restaurant(restaurant_id)

    query = RestaurantImage.query.filter(
        RestaurantImage.restaurant_id == restaurant_id,
        RestaurantImage.preview == True,  # noqa: E712 - SQLAlchemy column comparison
    )
    if keep_image_id is not None:
        query = query.filter(RestaurantImage.id != keep_image_id)
    for image in query.all():
        image.preview = False


def preview_image_urls(restaurant_ids):
    """
    {restaurant_id: cover photo url} for the given restaurants, in one query.

    Where a restaurant has more than one preview -- nothing in the schema stops
    it yet -- the highest id wins, which is what scanning the table in order
    used to leave behind.
    """
    from app.models import RestaurantImage, db

    ids = list(restaurant_ids)
    if not ids:
        return {}

    rows = db.session.query(RestaurantImage.restaurant_id, RestaurantImage.url).filter(
        RestaurantImage.restaurant_id.in_(ids),
        RestaurantImage.preview == True,  # noqa: E712 - SQLAlchemy column comparison
    ).order_by(RestaurantImage.id).all()
    return dict(rows)


def preview_image_url(restaurant_id):
    """The url of one restaurant's cover photo, or None when it has none."""
    return preview_image_urls([restaurant_id]).get(restaurant_id)


def review_stats(restaurant_ids):
    """
    {restaurant_id: (average rating, review count)}, in one aggregate query.

    The listing used to run a Review query per restaurant on top of loading
    every review in the table, and do the arithmetic in Python.
    """
    from app.models import Review, db

    ids = list(restaurant_ids)
    if not ids:
        return {}

    rows = db.session.query(
        Review.restaurant_id,
        func.avg(Review.rating),
        func.count(Review.id),
    ).filter(Review.restaurant_id.in_(ids)).group_by(Review.restaurant_id).all()
    # Postgres averages integers as Decimal, SQLite as float.
    return {restaurant_id: (float(average), count) for restaurant_id, average, count in rows}


def latest_review_texts(restaurant_ids):
    """
    {restaurant_id: the text of its newest review} -- the one line a card
    shows -- in one query.

    Newest is createdAt first and id only as the tie-break, which is the order
    the review feeds use, so a card's teaser is the review its feed puts at
    the top. Ranking on id alone would disagree with that: createdAt is set
    independently of insertion order, and the seeds do exactly that, spreading
    reviews over two years in the order they happen to be written.
    """
    from app.models import Review, db

    ids = list(restaurant_ids)
    if not ids:
        return {}

    ranked = db.session.query(
        Review.restaurant_id.label("restaurant_id"),
        Review.review.label("review"),
        func.row_number().over(
            partition_by=Review.restaurant_id,
            order_by=(Review.createdAt.desc(), Review.id.desc()),
        ).label("position"),
    ).filter(Review.restaurant_id.in_(ids)).subquery()

    rows = db.session.query(ranked.c.restaurant_id, ranked.c.review).filter(
        ranked.c.position == 1).all()
    return dict(rows)


def restaurant_cards(restaurants):
    """
    The card payload the listing, the search results and a profile's business
    list all show: the restaurant, its rating, how many reviews it has, its
    cover photo, and one review's text.

    Three queries whatever the number of restaurants -- though the ids go into
    an IN list, so the statement grows with the page even where the count of
    them does not. That is the argument for paginating the listing (#42), not
    for going back to a query per row.

    It is a batch helper and not a Restaurant method because avoiding the
    per-restaurant query is the whole point: a summary() called in a loop puts
    them straight back.
    """
    restaurants = list(restaurants)
    ids = [restaurant.id for restaurant in restaurants]
    stats = review_stats(ids)
    previews = preview_image_urls(ids)
    latest = latest_review_texts(ids)

    cards = []
    for restaurant in restaurants:
        average, count = stats.get(restaurant.id, (0, 0))
        card = restaurant.to_dict()
        card["avgRating"] = round(average, 2)
        card["numReviews"] = count
        card["previewImage"] = previews.get(restaurant.id)
        card["oneReview"] = latest.get(restaurant.id)
        cards.append(card)
    return cards


def review_with_details(review, restaurant=None, previews=None):
    """
    Serialize a review with its author, images, restaurant, and owner response.

    Shared by the review routes and the restaurant's own review listing, which
    live on different blueprints. `previews` is a {restaurant_id: url} map from
    reviews_with_details; without one the cover photo costs a query per review.
    """
    restaurant = restaurant or review.restaurant
    data = review.to_dict()
    data["user"] = review.user.to_dict_public() if review.user else None
    data["reviewImages"] = [image.to_dict() for image in review.review_images]
    if restaurant:
        restaurant_data = restaurant.to_dict()
        restaurant_data["previewImage"] = (previews.get(restaurant.id) if previews is not None
                                           else preview_image_url(restaurant.id))
        data["restaurant"] = restaurant_data
    else:
        data["restaurant"] = None
    data["response"] = review.response.to_dict() if review.response else None
    return data


def reviews_with_details(reviews, restaurant=None):
    """
    Serialize a page of reviews, reading every cover photo they need in one
    query instead of one per review.
    """
    reviews = list(reviews)
    if restaurant is not None:
        ids = [restaurant.id]
    else:
        ids = {review.restaurant_id for review in reviews}
    previews = preview_image_urls(ids)
    return [review_with_details(review, restaurant=restaurant, previews=previews)
            for review in reviews]


def key_still_referenced(object_key):
    """
    True when a remaining row still names this object.

    A caller can attach one upload of theirs in two places, so the last row to
    go is the one that may delete the object. This is the same question the
    url-based check used to ask, but on a key this app minted rather than on
    text a caller typed -- which is what stopped it being a way to delete
    other people's images.

    The narrow race the old check had remains: a row naming this key could be
    written between here and the delete. It can now only cost you your own
    object, because a key names its uploader.
    """
    from app.models import RestaurantImage, ReviewImage, User

    if not object_key:
        return True  # nothing to delete is the same as still in use

    if RestaurantImage.query.filter(RestaurantImage.s3_key == object_key).first():
        return True
    if ReviewImage.query.filter(ReviewImage.s3_key == object_key).first():
        return True
    return User.query.filter(User.profile_image_key == object_key).first() is not None
