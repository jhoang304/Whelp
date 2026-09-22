from .db import db, environment, SCHEMA, add_prefix_for_prod

# A restaurant is Japanese *and* a sushi bar, and "Japanese" is the same thing
# on every restaurant that serves it -- which is what a join table says and a
# text column on restaurants cannot. Filtering then asks for rows, not for a
# LIKE against free text that matches "not very Japanese" just as happily.
restaurant_categories = db.Table(
    "restaurant_categories",
    db.Column("restaurant_id", db.Integer,
              db.ForeignKey(add_prefix_for_prod("restaurants.id"), ondelete="CASCADE"),
              primary_key=True),
    db.Column("category_id", db.Integer,
              db.ForeignKey(add_prefix_for_prod("categories.id"), ondelete="CASCADE"),
              primary_key=True),
    **({"schema": SCHEMA} if environment == "production" else {}),
)


class Category(db.Model):
    """
    One cuisine or kind of place: "Japanese", "Wine Bars", "Breakfast & Brunch".

    The taxonomy is seeded and closed -- a restaurant picks from it rather than
    typing its own -- so that a filter for one category finds every restaurant
    in it, instead of splitting them across "BBQ", "Bbq" and "barbeque".
    """
    __tablename__ = "categories"

    if environment == "production":
        __table_args__ = {'schema': SCHEMA}

    id = db.Column(db.Integer, primary_key=True)
    # The name is what a chip shows; the slug is what a URL carries, so that
    # ?category=breakfast-brunch survives being pasted into a chat window.
    name = db.Column(db.String(50), nullable=False, unique=True)
    slug = db.Column(db.String(50), nullable=False, unique=True)

    restaurants = db.relationship(
        "Restaurant", secondary=restaurant_categories, back_populates="categories")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "slug": self.slug}
