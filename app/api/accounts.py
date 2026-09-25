"""
What deleting an account removes, what it keeps, and doing it.

The rule, decided in #44: the account goes, and so does everything that is
only the user's -- the restaurants they own (with those restaurants' photos,
reviews and hours), every photo they added anywhere, their saved list and
their avatar. The reviews they wrote stay, with no author, and are shown as
by "Deleted user": they are part of other businesses' ratings, and an owner's
reply to one should not end up replying to nothing.
"""
from app.api.aws_helpers import remove_keys_from_s3
from app.api.utils import key_still_referenced
from app.models import (
    Favorite, Restaurant, RestaurantImage, Review, ReviewImage, db)


def deletion_summary(user):
    """
    What deleting this account would do, in numbers a confirmation can show:
    {"restaurants": [{"id", "name", "reviews"}], "reviewsKept", "photos",
    "favorites"}.
    """
    owned = Restaurant.query.filter_by(user_id=user.id).order_by(Restaurant.name).all()
    owned_ids = [restaurant.id for restaurant in owned]
    reviews_on = dict(
        db.session.query(Review.restaurant_id, db.func.count(Review.id))
        .filter(Review.restaurant_id.in_(owned_ids))
        .group_by(Review.restaurant_id).all()
    ) if owned_ids else {}

    own_review_ids = [review_id for (review_id,) in
                      db.session.query(Review.id).filter(Review.user_id == user.id).all()]
    restaurant_photos = RestaurantImage.query.filter_by(createdByUserId=user.id).count()
    review_photos = (ReviewImage.query.filter(ReviewImage.review_id.in_(own_review_ids)).count()
                     if own_review_ids else 0)

    return {
        "restaurants": [{"id": restaurant.id, "name": restaurant.name,
                         "reviews": reviews_on.get(restaurant.id, 0)}
                        for restaurant in owned],
        "reviewsKept": len(own_review_ids),
        "photos": restaurant_photos + review_photos,
        "favorites": Favorite.query.filter_by(user_id=user.id).count(),
    }


def delete_account(user):
    """
    Delete the account as deletion_summary describes, in one transaction,
    then the bucket objects nothing points at any more.

    The keys are read before anything is deleted, because the rows that name
    them are what the delete removes; and the objects go only after the
    commit, so a failed delete never leaves rows pointing at missing photos.
    """
    owned = Restaurant.query.filter_by(user_id=user.id).all()
    owned_ids = [restaurant.id for restaurant in owned]
    own_reviews = Review.query.filter_by(user_id=user.id).all()

    keys = [user.profile_image_key]
    # Photos they added, to their own restaurants or anyone else's.
    keys += [key for (key,) in db.session.query(RestaurantImage.s3_key).filter(
        RestaurantImage.createdByUserId == user.id, RestaurantImage.s3_key.isnot(None)).all()]
    # Everything on the restaurants they own, whoever added it.
    if owned_ids:
        keys += [key for (key,) in db.session.query(RestaurantImage.s3_key).filter(
            RestaurantImage.restaurant_id.in_(owned_ids), RestaurantImage.s3_key.isnot(None)).all()]
        keys += [key for (key,) in db.session.query(ReviewImage.s3_key).join(
            Review, Review.id == ReviewImage.review_id).filter(
            Review.restaurant_id.in_(owned_ids), ReviewImage.s3_key.isnot(None)).all()]

    # Their restaurants, and with them those restaurants' reviews, photos,
    # hours, links to cuisines and amenities, and places on saved lists.
    for restaurant in owned:
        db.session.delete(restaurant)

    # Their reviews elsewhere stay, but not their photos.
    for review in own_reviews:
        if review.restaurant_id in owned_ids:
            continue  # already going with the restaurant
        for image in list(review.review_images):
            if image.s3_key:
                keys.append(image.s3_key)
            db.session.delete(image)

    # And lose their author, in SQL, before the user is deleted. SQLAlchemy
    # would null them anyway, since User.reviews has no cascade -- but that
    # holds only while nobody adds one, and a cascade there would delete
    # these reviews instead. Done here, there is nothing left for one to reach.
    db.session.flush()
    Review.query.filter(Review.user_id == user.id).update(
        {Review.user_id: None}, synchronize_session="fetch")

    # The account itself. Its photos on other restaurants, its replies to
    # reviews and its saved list cascade from the user.
    db.session.delete(user)
    db.session.commit()

    remove_keys_from_s3(sorted({key for key in keys if key and not key_still_referenced(key)}))
