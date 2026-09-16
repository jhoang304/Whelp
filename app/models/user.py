from .db import db, environment, SCHEMA, add_prefix_for_prod
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from sqlalchemy.sql import func

class User(db.Model, UserMixin):
    __tablename__ = 'users'

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), nullable=False, unique=True)
    email = db.Column(db.String(255), nullable=False, unique=True)
    hashed_password = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    # Optional avatar. Populated by the S3 upload flow (or any public image URL).
    profile_image_url = db.Column(db.String(255), nullable=True)
    createdAt = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updatedAt = db.Column(db.DateTime, nullable=False, server_default=func.now(),
                          onupdate=func.now())

    reviews = db.relationship("Review", back_populates="user")
    restaurants = db.relationship("Restaurant", back_populates="user")
    restaurant_images = db.relationship("RestaurantImage", back_populates="user", cascade="all, delete-orphan")
    review_responses = db.relationship("ReviewResponse", back_populates="user", cascade="all, delete-orphan")

    @property
    def password(self):
        return self.hashed_password

    @password.setter
    def password(self, password):
        self.hashed_password = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'last_name': self.last_name,
            'first_name': self.first_name,
            'profile_image_url': self.profile_image_url,
            'createdAt': self.createdAt,
        }

    def to_dict_public(self):
        """Profile data that is safe to show to anyone (no email)."""
        return {
            'id': self.id,
            'username': self.username,
            'last_name': self.last_name,
            'first_name': self.first_name,
            'profile_image_url': self.profile_image_url,
            'createdAt': self.createdAt,
        }
