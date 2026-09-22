"""
Open or closed, at the edges where it is actually decided.

The bar that shuts at two is the case worth writing down: at half past
midnight it is open, and the row saying so belongs to yesterday.
"""
from datetime import datetime, time
from zoneinfo import ZoneInfo

import pytest

from app.api.hours import (
    open_status, parse_time, runs_past_midnight, timezone_for_state)

CHICAGO = "America/Chicago"
MONDAY, TUESDAY, WEDNESDAY, SUNDAY = 0, 1, 2, 6


def at(weekday_name, hour, minute=0, zone=CHICAGO):
    """A moment in a real week: 2026-09-21 is a Monday."""
    days = {"mon": 21, "tue": 22, "wed": 23, "sun": 27}
    return datetime(2026, 9, days[weekday_name], hour, minute, tzinfo=ZoneInfo(zone))


def hours(*rows):
    """(weekday, "HH:MM", "HH:MM") triples as the model would hand them over."""
    return [(weekday, parse_time(opens), parse_time(closes))
            for weekday, opens, closes in rows]


WEEKDAY_LUNCH = hours((MONDAY, "11:00", "22:00"))


def test_nothing_to_say_without_hours():
    assert open_status([], CHICAGO, at("mon", 12)) is None


def test_nothing_to_say_without_a_timezone():
    """"We were never told" is not "closed", and must not be shown as one."""
    assert open_status(WEEKDAY_LUNCH, None, at("mon", 12)) is None


def test_nothing_to_say_when_the_zone_is_not_a_zone():
    assert open_status(WEEKDAY_LUNCH, "Mars/Olympus", at("mon", 12)) is None


def test_open_in_the_middle_of_the_day():
    assert open_status(WEEKDAY_LUNCH, CHICAGO, at("mon", 12)) == {
        "isOpen": True, "until": "22:00"}


def test_the_minute_it_opens_counts_as_open():
    assert open_status(WEEKDAY_LUNCH, CHICAGO, at("mon", 11, 0))["isOpen"] is True


def test_the_minute_it_closes_does_not():
    status = open_status(WEEKDAY_LUNCH, CHICAGO, at("mon", 22, 0))
    assert status["isOpen"] is False


def test_before_opening_it_says_when():
    assert open_status(WEEKDAY_LUNCH, CHICAGO, at("mon", 10, 59)) == {
        "isOpen": False, "opensAt": "11:00", "opensWeekday": MONDAY, "opensDay": "Monday"}


def test_a_day_with_no_row_is_closed():
    status = open_status(WEEKDAY_LUNCH, CHICAGO, at("tue", 12))
    assert status["isOpen"] is False
    assert status["opensDay"] == "Monday", "the next one is a week away"


def test_the_next_opening_can_be_later_this_week():
    week = hours((MONDAY, "11:00", "22:00"), (WEDNESDAY, "11:00", "22:00"))
    assert open_status(week, CHICAGO, at("tue", 12))["opensDay"] == "Wednesday"


def test_the_next_opening_wraps_around_the_week():
    week = hours((MONDAY, "11:00", "22:00"))
    assert open_status(week, CHICAGO, at("sun", 12))["opensDay"] == "Monday"


def test_after_closing_the_next_opening_is_not_today():
    """Today has already had its turn; the answer is the next day that opens."""
    week = hours((MONDAY, "11:00", "22:00"), (TUESDAY, "09:00", "17:00"))
    assert open_status(week, CHICAGO, at("mon", 23))["opensDay"] == "Tuesday"


# --- the bar that shuts at two -------------------------------------------

LATE = hours((MONDAY, "17:00", "02:00"))


def test_a_night_that_runs_past_midnight_is_one_row():
    assert runs_past_midnight(time(17, 0), time(2, 0)) is True
    assert runs_past_midnight(time(11, 0), time(22, 0)) is False


def test_open_late_on_the_day_it_opened():
    assert open_status(LATE, CHICAGO, at("mon", 23)) == {"isOpen": True, "until": "02:00"}


def test_still_open_after_midnight_on_yesterdays_row():
    assert open_status(LATE, CHICAGO, at("tue", 0, 30)) == {"isOpen": True, "until": "02:00"}


def test_closed_once_the_late_shift_ends():
    status = open_status(LATE, CHICAGO, at("tue", 2, 0))
    assert status["isOpen"] is False


def test_the_small_hours_of_a_day_it_never_opened():
    """Half past midnight on Wednesday: Tuesday closed, so nobody is serving."""
    assert open_status(LATE, CHICAGO, at("wed", 0, 30))["isOpen"] is False


# --- the clock on the restaurant's wall -----------------------------------

def test_the_same_moment_differs_by_where_the_restaurant_is():
    """
    21:00 in Houston is 19:00 in Los Angeles. A kitchen closing at 20:00 is
    shut in one city and serving in the other, which is the whole reason a
    restaurant carries a timezone.
    """
    kitchen = hours((MONDAY, "11:00", "20:00"))
    moment = datetime(2026, 9, 21, 21, 0, tzinfo=ZoneInfo("America/Chicago"))

    assert open_status(kitchen, "America/Chicago", moment)["isOpen"] is False
    assert open_status(kitchen, "America/Los_Angeles", moment)["isOpen"] is True


@pytest.mark.parametrize("state,expected", [
    ("TX", "America/Chicago"),
    ("tx", "America/Chicago"),
    (" CA ", "America/Los_Angeles"),
    ("NY", "America/New_York"),
    ("AZ", "America/Phoenix"),
    ("XX", None),
    ("", None),
    (None, None),
])
def test_a_state_suggests_a_timezone(state, expected):
    assert timezone_for_state(state) == expected


@pytest.mark.parametrize("value,expected", [
    ("11:00", time(11, 0)),
    (" 09:30 ", time(9, 30)),
    ("24:00", None),
    ("nine", None),
    ("", None),
    (None, None),
    (11, None),
])
def test_reading_a_time_off_a_request(value, expected):
    assert parse_time(value) == expected
