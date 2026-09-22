from app.models import db, Category, Restaurant, environment, SCHEMA
from sqlalchemy.sql import text

# The taxonomy a restaurant picks from. It is reference data rather than demo
# data -- `flask seed all` ensures it even on a database it otherwise leaves
# alone -- so adding a line here is all it takes to offer a new cuisine.
CATEGORIES = [
    ("American", "american"),
    ("Bakeries", "bakeries"),
    ("Barbecue", "barbecue"),
    ("Breakfast & Brunch", "breakfast-brunch"),
    ("Burgers", "burgers"),
    ("Cafes", "cafes"),
    ("Chinese", "chinese"),
    ("Cocktail Bars", "cocktail-bars"),
    ("Cuban", "cuban"),
    ("Desserts", "desserts"),
    ("French", "french"),
    ("Indian", "indian"),
    ("Italian", "italian"),
    ("Japanese", "japanese"),
    ("Korean", "korean"),
    ("Mediterranean", "mediterranean"),
    ("Mexican", "mexican"),
    ("New American", "new-american"),
    ("Pizza", "pizza"),
    ("Seafood", "seafood"),
    ("Southern", "southern"),
    ("Steakhouses", "steakhouses"),
    ("Sushi Bars", "sushi-bars"),
    ("Tapas", "tapas"),
    ("Thai", "thai"),
    ("Vegan", "vegan"),
    ("Vietnamese", "vietnamese"),
    ("Wine Bars", "wine-bars"),
]

# What the demo restaurants serve, by name: the seeded ids depend on insert
# order, and a list keyed on them goes quietly wrong the first time a
# restaurant is added to the middle of the seed.
ASSIGNMENTS = {
    "Nancy's Hustle": ["new-american", "wine-bars", "cocktail-bars"],
    "Uchi": ["japanese", "sushi-bars", "seafood"],
    "Lua Viet Kitchen": ["vietnamese"],
    "Bacari Silverlake": ["mediterranean", "tapas", "wine-bars"],
    "Gramercy Tavern": ["new-american", "american"],
    "Girl & The Goat": ["new-american", "tapas"],
    "Au Cheval": ["burgers", "breakfast-brunch", "american"],
    "Sixty Vines": ["wine-bars", "new-american", "pizza"],
    "Yardbird": ["southern", "breakfast-brunch", "cocktail-bars"],
    "Versailles": ["cuban", "bakeries", "cafes"],
}


def ensure_categories():
    """
    Add whatever the taxonomy has gained since this database was seeded, and
    return how many that was. Existing rows are left alone: a category's id is
    written into every restaurant that picked it.
    """
    existing = {slug for (slug,) in db.session.query(Category.slug).all()}
    missing = [Category(name=name, slug=slug)
               for name, slug in CATEGORIES if slug not in existing]
    if missing:
        db.session.add_all(missing)
        db.session.commit()
    return len(missing)


def seed_restaurant_categories():
    """Give the demo restaurants their cuisines. Run after both seeds."""
    by_slug = {category.slug: category for category in Category.query.all()}
    by_name = {restaurant.name: restaurant for restaurant in Restaurant.query.all()}

    for name, slugs in ASSIGNMENTS.items():
        restaurant = by_name.get(name)
        if restaurant is None:
            continue
        # KeyError on an unknown slug is the point: a typo here would
        # otherwise seed a restaurant with one category fewer than intended.
        restaurant.categories = [by_slug[slug] for slug in slugs]

    db.session.commit()


def undo_categories():
    if environment == "production":
        db.session.execute(text(
            f"TRUNCATE table {SCHEMA}.restaurant_categories RESTART IDENTITY CASCADE;"))
        db.session.execute(text(
            f"TRUNCATE table {SCHEMA}.categories RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text("DELETE FROM restaurant_categories"))
        db.session.execute(text("DELETE FROM categories"))

    db.session.commit()
