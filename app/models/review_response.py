from .db import db, environment, SCHEMA, add_prefix_for_prod
from sqlalchemy.sql import func


class ReviewResponse(db.Model):
    """A business owner's public reply to a review left on their restaurant.

    Each review can have at most one owner response (enforced by the unique
    constraint on review_id). Only the owner of the reviewed restaurant may
    create, edit, or delete the response (enforced in the API layer).
    """
    __tablename__ = 'review_responses'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    review_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("reviews.id")), nullable=False, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("users.id")), nullable=False)
    response = db.Column(db.String(1000), nullable=False)
    createdAt = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updatedAt = db.Column(db.DateTime, nullable=False, server_default=func.now())

    review = db.relationship("Review", back_populates="response")
    user = db.relationship("User", back_populates="review_responses")

    def to_dict(self):
        return {
            'id': self.id,
            'review_id': self.review_id,
            'user_id': self.user_id,
            'response': self.response,
            'createdAt': self.createdAt,
            'updatedAt': self.updatedAt,
            'user': {
                'id': self.user.id,
                'username': self.user.username,
                'first_name': self.user.first_name,
                'last_name': self.user.last_name,
                'profile_image_url': self.user.profile_image_url,
            } if self.user else None,
        }
