from sqlalchemy.sql import func

from .db import db, environment, SCHEMA, add_prefix_for_prod


class Favorite(db.Model):
    """
    A restaurant someone has saved to come back to.

    A row per save, and at most one per person per restaurant: saving twice
    is one bookmark, not two. The list is its owner's alone -- nothing about it
    is shown to anyone else -- and it goes when either side does.
    """
    __tablename__ = "favorites"

    __table_args__ = (
        db.UniqueConstraint("user_id", "restaurant_id", name="uq_favorites_user_restaurant"),
    ) + (({'schema': SCHEMA},) if environment == "production" else ())

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey(add_prefix_for_prod("users.id"), ondelete="CASCADE"),
        nullable=False, index=True)
    restaurant_id = db.Column(
        db.Integer, db.ForeignKey(add_prefix_for_prod("restaurants.id"), ondelete="CASCADE"),
        nullable=False, index=True)
    # The Saved tab lists the most recent first, so this is the sort key.
    createdAt = db.Column(db.DateTime, nullable=False, server_default=func.now())

    user = db.relationship("User", back_populates="favorites")
    restaurant = db.relationship("Restaurant", back_populates="favorites")
