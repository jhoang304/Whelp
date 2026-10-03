"""
Put the shared demo account back the way it was seeded (#136).

Anyone can log in as the demo, and what it changes, every later visitor
sees: the live Nancy's Hustle had been given Chinese, Indian and Italian
cuisines and daytime hours. The API now keeps the demo from deleting or
renaming its restaurants and from changing its profile; everything else it
may still change, and this puts it back:

- the demo's profile: username, names and picture;
- each of its seeded restaurants, found by name (which it can't change):
  every field, its cuisines, amenities, hours and timezone, its seeded
  photos -- any that are missing come back -- and its cover. A seeded
  restaurant that isn't there any more is made again.

It adds and restores; it removes nothing. Photos the demo added stay (only
the cover goes back to the seeded one), and so does any restaurant it made
itself. Run on every deploy, from the build command, it repairs the demo
each time the site is published, and a second run finds nothing to do.
"""
from app.api.hours import parse_time, timezone_for_state
from app.models import Amenity, Category, Restaurant, RestaurantHours, RestaurantImage, User, db
from app.models.user import DEMO_EMAIL

from .amenities import ASSIGNMENTS as AMENITY_ASSIGNMENTS, ensure_amenities
from .categories import ASSIGNMENTS as CATEGORY_ASSIGNMENTS, ensure_categories
from .hours import HOURS
from .restaurant_images import PHOTOS
from .restaurants import DEMO_SEED_USER_ID, RESTAURANTS
from .users import DEMO_PROFILE

# The restaurant's own columns the seed sets, besides its name and owner.
FIELDS = ("price", "address", "city", "state", "zipcode", "country", "phone_number", "website", "description")


def _seeded_hours(name):
    """[(weekday, opens, closes)] for a seeded restaurant, sorted."""
    return sorted(
        (weekday, parse_time(opens), parse_time(closes))
        for group, opens, closes in HOURS.get(name, [])
        for weekday in group
    )


def _restore_profile(demo, apply, notes):
    gets = []
    for field, value in DEMO_PROFILE.items():
        if getattr(demo, field) == value:
            continue
        if field == "username" and User.username_taken(value, by_anyone_but=demo.id):
            notes.append(f"Someone else now has the username {value!r}, so the demo keeps {demo.username!r}.")
            continue
        gets.append(field)
        if apply:
            setattr(demo, field, value)
            if field == "profile_image_url":
                # The seeded picture is a link, not an upload of the demo's.
                demo.profile_image_key = None
    return gets


def _restore_restaurant(demo, place, seed, categories, amenities, apply):
    """What putting one seeded restaurant back takes, and do it if asked."""
    name = seed["name"]
    gets = []
    restaurant = (Restaurant.query.filter_by(user_id=demo.id, name=name)
                  .order_by(Restaurant.id).first())
    if restaurant is None:
        gets.append("made again")
        if not apply:
            return gets
        restaurant = Restaurant(user_id=demo.id, name=name, **{field: seed[field] for field in FIELDS})
        db.session.add(restaurant)
        db.session.flush()

    changed = [field for field in FIELDS if getattr(restaurant, field) != seed[field]]
    if changed and "made again" not in gets:
        gets.append(", ".join(changed))
    if apply:
        for field in changed:
            setattr(restaurant, field, seed[field])

    zone = timezone_for_state(seed["state"])
    if restaurant.timezone != zone:
        gets.append("timezone")
        if apply:
            restaurant.timezone = zone

    slugs = CATEGORY_ASSIGNMENTS.get(name, [])
    if sorted(category.slug for category in restaurant.categories) != sorted(slugs):
        gets.append("cuisines")
        if apply:
            restaurant.categories = [categories[slug] for slug in slugs]

    slugs = AMENITY_ASSIGNMENTS.get(name, [])
    if sorted(amenity.slug for amenity in restaurant.amenities) != sorted(slugs):
        gets.append("amenities")
        if apply:
            restaurant.amenities = [amenities[slug] for slug in slugs]

    hours = _seeded_hours(name)
    if sorted((row.weekday, row.opens, row.closes) for row in restaurant.hours) != hours:
        gets.append("hours")
        if apply:
            # Cleared and flushed first, as the edit route does: one row per
            # weekday is a constraint, and a replaced Tuesday would otherwise
            # be inserted before the old one is deleted.
            restaurant.hours = []
            db.session.flush()
            restaurant.hours = [RestaurantHours(weekday=weekday, opens=opens, closes=closes)
                                for weekday, opens, closes in hours]

    urls = PHOTOS.get(place, [])
    have = {image.url: image for image in restaurant.restaurant_images}
    missing = [url for url in urls if url not in have]
    if missing:
        gets.append(f"{len(missing)} photo{'' if len(missing) == 1 else 's'}")
        if apply:
            for url in missing:
                image = RestaurantImage(restaurant_id=restaurant.id, url=url, preview=False)
                db.session.add(image)
                have[url] = image
            db.session.flush()

    if urls:
        # Photos just added above come in as plain photos, so they don't
        # change which ones are covers.
        cover = urls[0]
        covers = [image.url for image in restaurant.restaurant_images if image.preview]
        if covers != [cover]:
            gets.append("cover")
            if apply:
                # Every cover cleared and flushed before the seeded one is set:
                # one cover per restaurant is a constraint, and setting the new
                # one first would hold two for a moment.
                images = RestaurantImage.query.filter_by(restaurant_id=restaurant.id).order_by(RestaurantImage.id).all()
                for image in images:
                    image.preview = False
                db.session.flush()
                next(image for image in images if image.url == cover).preview = True

    return gets


def demo_reset(apply=True):
    """
    Return (changes, notes), and write the changes unless `apply` is False.

    `changes` is [(what, [what it gets back])], empty when the demo is as
    seeded. `notes` says what was left alone, and why.
    """
    notes = []
    demo = User.query.filter_by(email=DEMO_EMAIL).first()
    if demo is None:
        return [], ["There is no demo account in this database."]

    if apply:
        # Already done by `flask seed all` on every deploy; here so this works
        # on a database that has somehow never had them.
        ensure_categories()
        ensure_amenities()
    categories = {category.slug: category for category in Category.query.all()}
    amenities = {amenity.slug: amenity for amenity in Amenity.query.all()}

    changes = []
    gets = _restore_profile(demo, apply, notes)
    if gets:
        changes.append(("The demo's profile", gets))

    for place, seed in enumerate(RESTAURANTS, start=1):
        if seed["user_id"] != DEMO_SEED_USER_ID:
            continue
        gets = _restore_restaurant(demo, place, seed, categories, amenities, apply)
        if gets:
            changes.append((seed["name"], gets))

    if apply:
        db.session.commit()
    else:
        db.session.rollback()
    return changes, notes
