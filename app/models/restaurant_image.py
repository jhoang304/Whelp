from .db import db, environment, SCHEMA, add_prefix_for_prod
from sqlalchemy.sql import func
from .user import User
from .restaurant import Restaurant

# "At most one cover photo per restaurant" was enforced only by the code that
# happened to go through clear_other_previews. A partial unique index makes a
# second cover impossible to write, whatever the path, and makes the listing's
# choice of cover deterministic instead of whichever row iterated last.
one_preview_per_restaurant = db.Index(
    'uq_restaurant_images_one_preview',
    'restaurant_id',
    unique=True,
    sqlite_where=db.text('preview'),
    postgresql_where=db.text('preview'),
)


class RestaurantImage(db.Model):
    __tablename__ = 'restaurant_images'

    if environment == "production":
        __table_args__ = (one_preview_per_restaurant, {'schema': SCHEMA})
    else:
        __table_args__ = (one_preview_per_restaurant,)

    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey(add_prefix_for_prod("restaurants.id")),nullable=False)
    url = db.Column(db.String(255))
    # The object key this app minted for the uploader, when the url names one
    # of our objects and the caller uploaded it. Null for a hot-linked image,
    # a stranger's upload, or anything older than user-scoped keys -- and a
    # null key is never deleted from the bucket.
    s3_key = db.Column(db.String(255), nullable=True)
    preview = db.Column(db.Boolean, default=False)
    createdAt = db.Column(db.DateTime, nullable=False, server_default=func.now())
    updatedAt = db.Column(db.DateTime, nullable=False, server_default=func.now(),
                          onupdate=func.now())
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
