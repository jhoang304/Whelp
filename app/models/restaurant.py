from .db import db, environment, SCHEMA, add_prefix_for_prod
from sqlalchemy.sql import func
from .user import User
from .amenity import Amenity, restaurant_amenities
from .category import Category, restaurant_categories

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
    zipcode = db.Column(db.String(10), nullable=False)
    country = db.Column(db.String(56), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    website = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500), nullable=False)
    # An IANA zone, because "open now" is a question about the clock on the
    # restaurant's wall, not the one on the server or the reader's laptop.
    # Null means nobody has said, and the API declines to guess.
    timezone = db.Column(db.String(64))
    createdAt = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updatedAt = db.Column(db.DateTime, nullable=False, server_default=func.now(),
                          onupdate=func.now())

    user = db.relationship("User", back_populates="restaurants")
    reviews = db.relationship("Review", back_populates="restaurant", cascade="all, delete-orphan")
    restaurant_images = db.relationship("RestaurantImage", back_populates="restaurant", cascade="all, delete-orphan")
    categories = db.relationship(
        "Category", secondary=restaurant_categories, back_populates="restaurants",
        order_by=Category.name)
    amenities = db.relationship(
        "Amenity", secondary=restaurant_amenities, back_populates="restaurants",
        order_by=Amenity.name)
    hours = db.relationship(
        "RestaurantHours", back_populates="restaurant", cascade="all, delete-orphan",
        order_by="RestaurantHours.weekday")

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
            "description":self.description,
            "timezone":self.timezone
        }
