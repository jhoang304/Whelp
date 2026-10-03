from .db import db, environment, SCHEMA, add_prefix_for_prod
from sqlalchemy.sql import func
from .user import User
from .restaurant import Restaurant

class Review(db.Model):
    __tablename__ = 'reviews'

    # Both rules used to live only in the routes, which check and then
    # insert: two requests close together could each pass the check and
    # leave two reviews of one restaurant by one person (#119). A review
    # whose author has left has no user_id, and NULLs never clash, so any
    # number of "Deleted user" reviews can stand.
    #
    # And the two feeds, a restaurant's and a person's, newest first: each
    # index is the filter then the order, so a page comes straight off it
    # rather than every matching review being sorted first (#137).
    __table_args__ = (
        db.UniqueConstraint("user_id", "restaurant_id", name="uq_reviews_user_restaurant"),
        db.CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),
        db.Index("ix_reviews_restaurant_newest", "restaurant_id", "createdAt", "id"),
        db.Index("ix_reviews_user_newest", "user_id", "createdAt", "id"),
    ) + (({'schema': SCHEMA},) if environment == "production" else ())

    id = db.Column(db.Integer, primary_key=True)
    # Null once the author has deleted their account. The review stays -- its
    # rating is part of a restaurant's average, and the business's reply to it
    # would otherwise lose what it was replying to -- and is shown as written
    # by "Deleted user". Nobody can edit or delete it after that.
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id")), nullable=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("restaurants.id")), nullable=False)
    # Text, not String(255): two sentences was all a review could hold (#133).
    # The limit is the form's, MAX_REVIEW_LENGTH.
    review = db.Column(db.Text, nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    createdAt = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updatedAt = db.Column(db.DateTime, nullable=False, server_default=func.now(),
                          onupdate=func.now())

    user = db.relationship("User", back_populates="reviews")
    restaurant = db.relationship("Restaurant", back_populates="reviews")
    review_images = db.relationship("ReviewImage", back_populates="review", cascade="all, delete")
    # A review has at most one owner response; deleting the review removes it.
    response = db.relationship("ReviewResponse", back_populates="review", uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'restaurant_id': self.restaurant_id,
            'review': self.review,
            'rating': self.rating,
            'createdAt': self.createdAt,
            'updatedAt': self.updatedAt,
        }
