"""
Give the demo restaurants the details a populated database never received.

`flask seed all` skips everything when a database already has users, which
is what keeps a redeploy from erasing real reviews -- but it also means the
cuisines, amenities and opening hours added since the first seed only ever
reached empty databases. Production has the restaurants and the vocabularies,
and nothing joining the two.

This fills those gaps and nothing else:

- Only restaurants whose names match the demo seed are touched, and a name
  that matches more than one restaurant is skipped rather than guessed at.
- Only what is empty is filled. A restaurant with any cuisines, amenities or
  hours keeps them exactly, because an owner may have set them.
- Nothing is written without `apply=True`.

It is a command to run once, by hand, and not a build step. A restaurant with
no hours is indistinguishable from one whose owner cleared them, so running
this on every deploy would keep putting back hours someone had taken away.
"""
from app.api.hours import parse_time, timezone_for_state
from app.models import Amenity, Category, Restaurant, RestaurantHours, db

from .amenities import ASSIGNMENTS as AMENITY_ASSIGNMENTS, ensure_amenities
from .categories import ASSIGNMENTS as CATEGORY_ASSIGNMENTS, ensure_categories
from .hours import HOURS


def demo_names():
    """Every restaurant the seeds describe, in a stable order."""
    names = set(CATEGORY_ASSIGNMENTS) | set(AMENITY_ASSIGNMENTS) | set(HOURS)
    return sorted(names)


def backfill(apply=False):
    """
    Return (changes, not_found, ambiguous), and write the changes if asked.

    `changes` is [(restaurant name, [what it gets])]. A restaurant with
    nothing missing does not appear in it, which is what makes a second run
    report nothing to do.
    """
    if apply:
        # Already done by `flask seed all` on every deploy; here so the command
        # also works on a database that has somehow never had them.
        ensure_categories()
        ensure_amenities()

    categories = {category.slug: category for category in Category.query.all()}
    amenities = {amenity.slug: amenity for amenity in Amenity.query.all()}

    changes = []
    not_found = []
    ambiguous = []

    for name in demo_names():
        matches = Restaurant.query.filter_by(name=name).all()
        if not matches:
            not_found.append(name)
            continue
        if len(matches) > 1:
            # Someone has created a second "Uchi". Which one is the demo is not
            # something to guess at in a production database.
            ambiguous.append(name)
            continue

        restaurant = matches[0]
        gets = []

        slugs = CATEGORY_ASSIGNMENTS.get(name)
        if slugs and not restaurant.categories:
            gets.append(f"cuisines ({', '.join(slugs)})")
            if apply:
                restaurant.categories = [categories[slug] for slug in slugs]

        slugs = AMENITY_ASSIGNMENTS.get(name)
        if slugs and not restaurant.amenities:
            gets.append(f"amenities ({', '.join(slugs)})")
            if apply:
                restaurant.amenities = [amenities[slug] for slug in slugs]

        shifts = HOURS.get(name)
        if shifts and not restaurant.hours:
            days = sorted({weekday for group, _, _ in shifts for weekday in group})
            gets.append(f"hours ({len(days)} days)")
            if apply:
                restaurant.hours = [
                    RestaurantHours(weekday=weekday, opens=parse_time(opens),
                                    closes=parse_time(closes))
                    for group, opens, closes in shifts
                    for weekday in group
                ]

        # A timezone is what the hours are read against, so a restaurant that
        # has hours -- ours or its owner's -- but no zone still needs one.
        if restaurant.timezone is None:
            zone = timezone_for_state(restaurant.state)
            if zone:
                gets.append(f"timezone {zone}")
                if apply:
                    restaurant.timezone = zone

        if gets:
            changes.append((name, gets))

    if apply:
        db.session.commit()

    return changes, not_found, ambiguous
