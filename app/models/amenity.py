from .db import db, environment, SCHEMA, add_prefix_for_prod

# What a restaurant offers, as rows rather than a column of booleans: the
# vocabulary is closed and seeded, the same shape as categories, so a filter
# for "offers delivery" is a join rather than another migration.
restaurant_amenities = db.Table(
    "restaurant_amenities",
    db.Column("restaurant_id", db.Integer,
              db.ForeignKey(add_prefix_for_prod("restaurants.id"), ondelete="CASCADE"),
              primary_key=True),
    db.Column("amenity_id", db.Integer,
              db.ForeignKey(add_prefix_for_prod("amenities.id"), ondelete="CASCADE"),
              primary_key=True),
    **({"schema": SCHEMA} if environment == "production" else {}),
)


class Amenity(db.Model):
    """One thing a restaurant offers: delivery, takeout, outdoor seating."""
    __tablename__ = "amenities"

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    slug = db.Column(db.String(50), nullable=False, unique=True)

    restaurants = db.relationship(
        "Restaurant", secondary=restaurant_amenities, back_populates="amenities")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "slug": self.slug}
