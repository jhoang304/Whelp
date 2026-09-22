"""
Whether a restaurant is open, and when that next changes.

Everything here is a pure function over (hours, timezone, now), because the
answers that matter are all boundaries -- one minute before opening, the
minute of closing, half past midnight at a bar that shuts at two -- and a
function that reads the clock itself cannot be asked about them.
"""
from datetime import datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

# The zone most of each state keeps. Several states are split -- Texas west of
# Van Horn is Mountain, the Florida panhandle is Central -- so this is a
# starting point a restaurant can correct, not a fact about its address.
STATE_TIMEZONES = {
    "AL": "America/Chicago", "AK": "America/Anchorage", "AZ": "America/Phoenix",
    "AR": "America/Chicago", "CA": "America/Los_Angeles", "CO": "America/Denver",
    "CT": "America/New_York", "DE": "America/New_York", "DC": "America/New_York",
    "FL": "America/New_York", "GA": "America/New_York", "HI": "Pacific/Honolulu",
    "ID": "America/Boise", "IL": "America/Chicago", "IN": "America/Indiana/Indianapolis",
    "IA": "America/Chicago", "KS": "America/Chicago", "KY": "America/New_York",
    "LA": "America/Chicago", "ME": "America/New_York", "MD": "America/New_York",
    "MA": "America/New_York", "MI": "America/Detroit", "MN": "America/Chicago",
    "MS": "America/Chicago", "MO": "America/Chicago", "MT": "America/Denver",
    "NE": "America/Chicago", "NV": "America/Los_Angeles", "NH": "America/New_York",
    "NJ": "America/New_York", "NM": "America/Denver", "NY": "America/New_York",
    "NC": "America/New_York", "ND": "America/Chicago", "OH": "America/New_York",
    "OK": "America/Chicago", "OR": "America/Los_Angeles", "PA": "America/New_York",
    "RI": "America/New_York", "SC": "America/New_York", "SD": "America/Chicago",
    "TN": "America/Chicago", "TX": "America/Chicago", "UT": "America/Denver",
    "VT": "America/New_York", "VA": "America/New_York", "WA": "America/Los_Angeles",
    "WV": "America/New_York", "WI": "America/Chicago", "WY": "America/Denver",
}


def timezone_for_state(state):
    """A starting timezone for a US state, or None when we cannot say."""
    if not state or not isinstance(state, str):
        return None
    return STATE_TIMEZONES.get(state.strip().upper())


def zone(name):
    """The named zone, or None if it is unknown to this machine."""
    if not name:
        return None
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        # A bad name in a row should read as "we don't know when they're
        # open", not take the listing down with it.
        return None


def parse_time(value):
    """"HH:MM" as a time, or None if it is not one."""
    if isinstance(value, time):
        return value
    if not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value.strip(), "%H:%M").time()
    except ValueError:
        return None


def runs_past_midnight(opens, closes):
    return closes <= opens


def _covers(opens, closes, moment):
    """Is `moment` inside this day's opening, on the day it opens?"""
    if runs_past_midnight(opens, closes):
        return moment >= opens
    return opens <= moment < closes


def open_status(hours, timezone_name, now=None):
    """
    {"isOpen": ..., "until": "HH:MM"} or {"isOpen": False, "opensAt": ...}, or
    None when there is nothing to say.

    `hours` is [(weekday, opens, closes), ...]. None comes back when the
    restaurant has no hours or no usable timezone: "we have not been told" is
    a different answer from "closed", and only one of them should be shown.
    """
    by_day = {weekday: (opens, closes) for weekday, opens, closes in hours}
    if not by_day:
        return None

    where = zone(timezone_name)
    if where is None:
        return None

    now = now.astimezone(where) if now is not None else datetime.now(where)
    today = now.weekday()
    moment = now.time()

    # Today's own hours, and yesterday's if they spilled over midnight.
    for day in (today, (today - 1) % 7):
        if day not in by_day:
            continue
        opens, closes = by_day[day]
        if day == today:
            if _covers(opens, closes, moment):
                return {"isOpen": True, "until": closes.strftime("%H:%M")}
        elif runs_past_midnight(opens, closes) and moment < closes:
            # Yesterday's late shift is still running.
            return {"isOpen": True, "until": closes.strftime("%H:%M")}

    # Closed, so say when that ends. Today counts if it has not opened yet.
    for ahead in range(0, 8):
        day = (today + ahead) % 7
        if day not in by_day:
            continue
        opens, _ = by_day[day]
        if ahead == 0 and opens <= moment:
            continue
        return {
            "isOpen": False,
            "opensAt": opens.strftime("%H:%M"),
            "opensWeekday": day,
            "opensDay": DAYS[day],
        }

    return {"isOpen": False}


# --- reading and writing hours -------------------------------------------

def hours_by_restaurant(restaurant_ids):
    """{restaurant_id: [(weekday, opens, closes), ...]}, in one query."""
    from app.models import RestaurantHours, db

    ids = list(restaurant_ids)
    if not ids:
        return {}

    rows = db.session.query(
        RestaurantHours.restaurant_id, RestaurantHours.weekday,
        RestaurantHours.opens, RestaurantHours.closes,
    ).filter(RestaurantHours.restaurant_id.in_(ids)).order_by(
        RestaurantHours.weekday).all()

    grouped = {}
    for restaurant_id, weekday, opens, closes in rows:
        grouped.setdefault(restaurant_id, []).append((weekday, opens, closes))
    return grouped


def hours_to_dicts(rows):
    """[(weekday, opens, closes)] as the API sends them."""
    return [{"weekday": weekday,
             "opens": opens.strftime("%H:%M"),
             "closes": closes.strftime("%H:%M")}
            for weekday, opens, closes in rows]


def read_hours(payload):
    """
    (rows, error) for the `hours` in a create or edit body, where each row is
    {"weekday": 0-6, "opens": "HH:MM", "closes": "HH:MM"}.

    None means the body never mentioned hours and they are left alone; an
    empty list means closed all week, which is a thing a restaurant may say.
    A day appearing twice is refused rather than merged: it is a bug in the
    caller, and picking one of the two silently would hide it.
    """
    if not isinstance(payload, dict) or payload.get("hours") is None:
        return None, None

    raw = payload["hours"]
    if not isinstance(raw, list):
        return None, "hours must be a list of days."
    if len(raw) > 7:
        return None, "hours cannot have more than seven days."

    rows = []
    seen = set()
    for entry in raw:
        if not isinstance(entry, dict):
            return None, "Each day needs a weekday, an opening time and a closing time."

        weekday = entry.get("weekday")
        if isinstance(weekday, bool) or not isinstance(weekday, int) or not 0 <= weekday <= 6:
            return None, "weekday must be a whole number from 0 (Monday) to 6 (Sunday)."
        if weekday in seen:
            return None, f"{DAYS[weekday]} is listed twice."
        seen.add(weekday)

        opens = parse_time(entry.get("opens"))
        closes = parse_time(entry.get("closes"))
        if opens is None or closes is None:
            return None, f"{DAYS[weekday]} needs an opening and closing time as HH:MM."

        rows.append((weekday, opens, closes))

    return rows, None


def read_timezone(payload, fallback_state=None):
    """
    (timezone, error) for a create or edit body.

    An absent timezone is taken from the state, which is where a restaurant's
    would start anyway; an unknown state simply leaves it unset, and the API
    then declines to say whether the place is open.
    """
    if isinstance(payload, dict) and payload.get("timezone") is not None:
        name = payload["timezone"]
        if not isinstance(name, str) or zone(name) is None:
            return None, "timezone must be a name like America/Chicago."
        return name, None

    return timezone_for_state(fallback_state), None
