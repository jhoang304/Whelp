from app.models import db, Restaurant, RestaurantHours, environment, SCHEMA
from sqlalchemy.sql import text

from app.api.hours import parse_time, timezone_for_state

MON, TUE, WED, THU, FRI, SAT, SUN = range(7)
WEEK = (MON, TUE, WED, THU, FRI, SAT, SUN)

# When the demo restaurants are open, as (days, opens, closes).
#
# A day not listed is a day that restaurant is closed. `closes` at or before
# `opens` is a night that runs past midnight -- Au Cheval until 1am, Versailles
# until midnight -- which is a real thing restaurants do and the part of this
# the open/closed logic most needs to be handed.
HOURS = {
    "Nancy's Hustle": [
        ((TUE, WED, THU), "17:00", "22:00"),
        ((FRI, SAT), "17:00", "23:00"),
    ],
    "Uchi": [
        ((MON, TUE, WED, THU, SUN), "17:00", "22:00"),
        ((FRI, SAT), "17:00", "23:00"),
    ],
    "Lua Viet Kitchen": [
        ((MON, TUE, WED, THU, FRI, SAT), "11:00", "21:00"),
    ],
    "Bacari Silverlake": [
        ((MON, TUE, WED, THU, SUN), "12:00", "23:00"),
        ((FRI, SAT), "12:00", "02:00"),
    ],
    "Gramercy Tavern": [
        (WEEK, "11:30", "22:00"),
    ],
    "Girl & The Goat": [
        (WEEK, "16:00", "23:00"),
    ],
    "Au Cheval": [
        (WEEK, "11:00", "01:00"),
    ],
    "Sixty Vines": [
        ((MON, TUE, WED, THU), "11:00", "22:00"),
        ((FRI, SAT), "11:00", "23:00"),
        ((SUN,), "10:00", "21:00"),
    ],
    "Yardbird": [
        ((MON, TUE, WED, THU, SUN), "11:00", "23:00"),
        ((FRI, SAT), "11:00", "01:00"),
    ],
    "Versailles": [
        (WEEK, "08:00", "00:00"),
    ],
}


def seed_restaurant_hours():
    """
    Opening hours for the demo restaurants, and the timezone to read them in.

    The timezone comes from the state, which is where a real restaurant's
    would start too -- these ten are spread over four of them, so a single
    server-side clock would have "open now" wrong for most of the list.
    """
    by_name = {restaurant.name: restaurant for restaurant in Restaurant.query.all()}

    for name, shifts in HOURS.items():
        restaurant = by_name.get(name)
        if restaurant is None:
            continue

        restaurant.timezone = timezone_for_state(restaurant.state)
        restaurant.hours = [
            RestaurantHours(weekday=weekday, opens=parse_time(opens), closes=parse_time(closes))
            for days, opens, closes in shifts
            for weekday in days
        ]

    db.session.commit()


def undo_hours():
    if environment == "production":
        db.session.execute(text(
            f"TRUNCATE table {SCHEMA}.restaurant_hours RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text("DELETE FROM restaurant_hours"))

    db.session.commit()
