from .db import db, environment, SCHEMA, add_prefix_for_prod
from sqlalchemy.sql import func
from .user import User

class Restaurant(db.Model):
    __tablename__ = 'restaurants'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod('users.id')),nullable=False)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.String(5), nullable=False)
    address = db.Column(db.String(100), nullable=False)
    city = db.Column(db.String(50), nullable=False)
    state = db.Column(db.String(50), nullable=False)
    zipcode = db.Column(db.Integer, nullable=False)
    country = db.Column(db.String(20), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    website = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500), nullable=False)
    createdAt = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updatedAt = db.Column(db.DateTime, nullable=False, server_default=func.now())

    user = db.relationship("User", back_populates="restaurants")
    reviews = db.relationship("Review", back_populates="restaurant", cascade="all, delete-orphan")
    restaurant_images = db.relationship("RestaurantImage", back_populates="restaurant", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            "user_id" : self.user_id,
            "name" : self.name,
            "price":self.price,
            "address":self.address,
            "city":self.city,
            "state":self.state,
            "zipcode":self.zipcode,
            "country":self.country,
            "phone_number":self.phone_number,
            "website":self.website,
            "description":self.description
        }
