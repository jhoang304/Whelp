from app.models import db, Amenity, Restaurant, environment, SCHEMA
from sqlalchemy.sql import text

# What a restaurant can offer. Reference data like the cuisine taxonomy, and
# ensured the same way, so adding a line here reaches a database that already
# has restaurants in it.
AMENITIES = [
    ("Takes Reservations", "reservations"),
    ("Offers Delivery", "delivery"),
    ("Offers Takeout", "takeout"),
    ("Outdoor Seating", "outdoor-seating"),
    ("Accepts Credit Cards", "credit-cards"),
    ("Wheelchair Accessible", "wheelchair-accessible"),
    ("Free Wi-Fi", "wifi"),
    ("Good for Groups", "groups"),
]

# The demo restaurants, by name: the seeded ids depend on insert order, and a
# list keyed on them goes quietly wrong the first time one is added.
ASSIGNMENTS = {
    "Nancy's Hustle": ["reservations", "credit-cards", "outdoor-seating", "groups"],
    "Uchi": ["reservations", "credit-cards", "wheelchair-accessible", "groups"],
    "Lua Viet Kitchen": ["takeout", "delivery", "credit-cards", "wifi"],
    "Bacari Silverlake": ["outdoor-seating", "credit-cards", "groups", "delivery"],
    "Gramercy Tavern": ["reservations", "credit-cards", "wheelchair-accessible"],
    "Girl & The Goat": ["reservations", "credit-cards", "groups"],
    "Au Cheval": ["takeout", "credit-cards", "groups"],
    "Sixty Vines": ["reservations", "outdoor-seating", "credit-cards", "groups"],
    "Yardbird": ["reservations", "takeout", "delivery", "credit-cards"],
    "Versailles": ["takeout", "delivery", "credit-cards", "wheelchair-accessible"],
}


def ensure_amenities():
    """Add whatever the list has gained, and return how many that was."""
    existing = {slug for (slug,) in db.session.query(Amenity.slug).all()}
    missing = [Amenity(name=name, slug=slug)
               for name, slug in AMENITIES if slug not in existing]
    if missing:
        db.session.add_all(missing)
        db.session.commit()
    return len(missing)


def seed_restaurant_amenities():
    """Give the demo restaurants what they offer. Run after both seeds."""
    by_slug = {amenity.slug: amenity for amenity in Amenity.query.all()}
    by_name = {restaurant.name: restaurant for restaurant in Restaurant.query.all()}

    for name, slugs in ASSIGNMENTS.items():
        restaurant = by_name.get(name)
        if restaurant is None:
            continue
        # KeyError on an unknown slug is the point: a typo here would
        # otherwise seed one amenity fewer than intended.
        restaurant.amenities = [by_slug[slug] for slug in slugs]

    db.session.commit()


def undo_amenities():
    if environment == "production":
        db.session.execute(text(
            f"TRUNCATE table {SCHEMA}.restaurant_amenities RESTART IDENTITY CASCADE;"))
        db.session.execute(text(
            f"TRUNCATE table {SCHEMA}.amenities RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text("DELETE FROM restaurant_amenities"))
        db.session.execute(text("DELETE FROM amenities"))

    db.session.commit()
