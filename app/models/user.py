from .db import db, environment, SCHEMA, add_prefix_for_prod
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from sqlalchemy.sql import func

# The account behind "Log in as Demo User". Everyone who tries the site shares
# it, so it cannot change its password or delete itself: either would lock
# every later visitor out of the demo.
DEMO_EMAIL = "demo@aa.io"


class User(db.Model, UserMixin):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(40), nullable=False, unique=True)
    email = db.Column(db.String(255), nullable=False, unique=True)
    # None for an account made with Google, until its owner sets a password.
    hashed_password = db.Column(db.String(255), nullable=True)
    # The Google account that signs in to this one: the ID token's "sub",
    # which stays the same when the Google account's address changes. None
    # when Google isn't connected.
    google_sub = db.Column(db.String(255), nullable=True)

    # One account per address, whatever case it was typed in. The column's
    # own constraint tells "Owner@x.io" from "owner@x.io", and signup let the
    # second become another account (#117). And one Whelp account per Google
    # account.
    __table_args__ = (
        db.Index("uq_users_email_lower", func.lower(email), unique=True),
        db.Index("uq_users_google_sub", google_sub, unique=True),
    ) + (({'schema': SCHEMA},) if environment == "production" else ())
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    # Optional avatar. Populated by the S3 upload flow (or any public image URL).
    profile_image_url = db.Column(db.String(255), nullable=True)
    profile_image_key = db.Column(db.String(255), nullable=True)
    createdAt = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updatedAt = db.Column(db.DateTime, nullable=False, server_default=func.now(),
                          onupdate=func.now())

    # No cascade, and that is the point: deleting an account keeps the reviews
    # it wrote, with no author -- "Deleted user". A delete cascade here would
    # take other businesses' ratings with it; app/api/accounts.py nulls the
    # author first so that even one could not.
    reviews = db.relationship("Review", back_populates="user")
    restaurants = db.relationship("Restaurant", back_populates="user")
    restaurant_images = db.relationship("RestaurantImage", back_populates="user", cascade="all, delete-orphan")
    review_responses = db.relationship("ReviewResponse", back_populates="user", cascade="all, delete-orphan")
    favorites = db.relationship("Favorite", back_populates="user", cascade="all, delete-orphan")

    @classmethod
    def with_email(cls, email):
        """The account with this address, whatever case either is written in."""
        return cls.query.filter(func.lower(cls.email) == email.strip().lower()).first()

    @classmethod
    def username_taken(cls, username, by_anyone_but=None):
        """
        Whether someone already goes by this name, whatever its case: "Owner"
        beside "owner" reads as the same person next to a review.
        """
        query = cls.query.filter(func.lower(cls.username) == username.strip().lower())
        if by_anyone_but is not None:
            query = query.filter(cls.id != by_anyone_but)
        return query.first() is not None

    @property
    def is_demo(self):
        return self.email == DEMO_EMAIL

    @property
    def has_password(self):
        """False for an account made with Google whose owner hasn't set one."""
        return self.hashed_password is not None

    @property
    def password(self):
        return self.hashed_password

    @password.setter
    def password(self, password):
        self.hashed_password = generate_password_hash(password)

    def check_password(self, password):
        # No password is matched by none.
        return self.has_password and check_password_hash(self.password, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'last_name': self.last_name,
            'first_name': self.first_name,
            'profile_image_url': self.profile_image_url,
            'createdAt': self.createdAt,
            # The page leaves out what the API refuses the shared demo (#136).
            'isDemo': self.is_demo,
            # Which ways in the account has, for Account settings.
            'hasPassword': self.has_password,
            'googleConnected': self.google_sub is not None,
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
