from .db import db, environment, SCHEMA, add_prefix_for_prod
from sqlalchemy.sql import func
from .user import User
from .restaurant import Restaurant

class RestaurantImage(db.Model):
    __tablename__ = 'restaurant_images'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("restaurants.id")),nullable=False)
    url = db.Column(db.String(255))
    preview = db.Column(db.Boolean, default=False)
    createdAt = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updatedAt = db.Column(db.DateTime, nullable=False, server_default=func.now())
    createdByUserId = db.Column(db.Integer,db.ForeignKey(add_prefix_for_prod("users.id")))


    restaurant = db.relationship("Restaurant", back_populates="restaurant_images")
    user = db.relationship("User",back_populates="restaurant_images")

    def to_dict(self):
        return {
            'id': self.id,
            'restaurant_id': self.restaurant_id,
            'url': self.url,
            'preview': self.preview,
            'createdAt': self.createdAt,
            'updatedAt': self.updatedAt,
            "createdByUserId":self.createdByUserId
        }
