"""
Hours and amenities over the API: what a card carries, what a detail page
carries, and what an owner may set.

The interesting distinction throughout is between "closed" and "nobody has
said": a restaurant with no hours gets no open/closed line at all, rather than
being reported shut.
"""
from datetime import time

from app.models import Amenity, Restaurant, RestaurantHours, db
from tests.conftest import login

MONDAY, TUESDAY, SUNDAY = 0, 1, 6


def payload(**overrides):
    body = {
        "name": "Test Bistro",
        "price": "$$",
        "address": "1 Main St",
        "city": "Houston",
        "state": "TX",
        "zipcode": "77001",
        "country": "USA",
        "phone_number": "(555) 555-5555",
        "website": "http://testbistro.com",
        "description": "A place for tests.",
    }
    body.update(overrides)
    return body


def add_amenities(*pairs):
    made = [Amenity(name=name, slug=slug) for name, slug in pairs]
    db.session.add_all(made)
    db.session.commit()
    return {amenity.name: amenity.id for amenity in made}


def give_hours(restaurant_id, *rows):
    restaurant = db.session.get(Restaurant, restaurant_id)
    restaurant.hours = [RestaurantHours(weekday=weekday, opens=time(*opens), closes=time(*closes))
                        for weekday, opens, closes in rows]
    db.session.commit()


def set_timezone(restaurant_id, name):
    db.session.get(Restaurant, restaurant_id).timezone = name
    db.session.commit()


# --- what comes out -------------------------------------------------------

def test_the_list_of_amenities_is_served_by_name(client):
    add_amenities(("Offers Takeout", "takeout"), ("Accepts Credit Cards", "credit-cards"))

    res = client.get("/api/amenities/")

    assert res.status_code == 200
    assert [item["name"] for item in res.get_json()["items"]] == [
        "Accepts Credit Cards", "Offers Takeout"]


def test_a_restaurant_that_has_not_said_gets_no_open_line(client, ids):
    """Not `false`: "we were never told" and "closed" are different answers."""
    card = client.get("/api/restaurants/").get_json()["items"][0]
    detail = client.get(f"/api/restaurants/{ids['restaurant']}").get_json()

    assert card["openStatus"] is None
    assert detail["openStatus"] is None
    assert detail["hours"] == []


def test_hours_without_a_timezone_still_say_nothing(client, ids):
    """The hours alone do not fix the clock they are read against."""
    give_hours(ids["restaurant"], (MONDAY, (11, 0), (22, 0)))

    assert client.get(f"/api/restaurants/{ids['restaurant']}").get_json()["openStatus"] is None


def test_a_card_carries_what_the_restaurant_offers(client, ids):
    made = add_amenities(("Offers Takeout", "takeout"), ("Free Wi-Fi", "wifi"))
    restaurant = db.session.get(Restaurant, ids["restaurant"])
    restaurant.amenities = Amenity.query.all()
    db.session.commit()

    card = client.get("/api/restaurants/").get_json()["items"][0]

    assert [item["name"] for item in card["amenities"]] == ["Free Wi-Fi", "Offers Takeout"]
    assert len(made) == 2


def test_the_detail_page_lists_the_week(client, ids):
    give_hours(ids["restaurant"], (SUNDAY, (10, 0), (21, 0)), (MONDAY, (11, 0), (22, 0)))
    set_timezone(ids["restaurant"], "America/Chicago")

    body = client.get(f"/api/restaurants/{ids['restaurant']}").get_json()

    assert body["hours"] == [
        {"weekday": MONDAY, "opens": "11:00", "closes": "22:00"},
        {"weekday": SUNDAY, "opens": "10:00", "closes": "21:00"},
    ], "in weekday order, whatever order they were written in"
    assert body["timezone"] == "America/Chicago"
    assert body["openStatus"] is not None


# --- what goes in ---------------------------------------------------------

def test_creating_a_restaurant_takes_its_timezone_from_the_state(client, ids):
    login(client, "owner@test.io")

    res = client.post("/api/restaurants/", json=payload(name="New Bistro", state="CA"))

    assert res.status_code == 200, res.get_json()
    assert res.get_json()["timezone"] == "America/Los_Angeles"


def test_a_state_nobody_knows_leaves_the_timezone_unset(client, ids):
    login(client, "owner@test.io")

    res = client.post("/api/restaurants/", json=payload(name="Far Away", state="ZZ"))

    assert res.status_code == 200, res.get_json()
    assert res.get_json()["timezone"] is None


def test_an_owner_sets_the_hours(client, ids):
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(hours=[
        {"weekday": MONDAY, "opens": "11:00", "closes": "22:00"},
        {"weekday": TUESDAY, "opens": "17:00", "closes": "02:00"},
    ]))

    assert res.status_code == 200, res.get_json()
    assert res.get_json()["hours"] == [
        {"weekday": MONDAY, "opens": "11:00", "closes": "22:00"},
        {"weekday": TUESDAY, "opens": "17:00", "closes": "02:00"},
    ]
    assert RestaurantHours.query.count() == 2


def test_an_edit_that_never_mentions_hours_keeps_them(client, ids):
    """The body every client written before this feature sends."""
    give_hours(ids["restaurant"], (MONDAY, (11, 0), (22, 0)))
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(name="Renamed"))

    assert res.status_code == 200, res.get_json()
    assert len(res.get_json()["hours"]) == 1


def test_an_empty_list_closes_every_day(client, ids):
    give_hours(ids["restaurant"], (MONDAY, (11, 0), (22, 0)))
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(hours=[]))

    assert res.status_code == 200, res.get_json()
    assert res.get_json()["hours"] == []
    assert RestaurantHours.query.count() == 0, "the old days are gone, not orphaned"


def test_setting_hours_replaces_the_days_that_are_no_longer_there(client, ids):
    give_hours(ids["restaurant"], (MONDAY, (11, 0), (22, 0)), (TUESDAY, (11, 0), (22, 0)))
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(
        hours=[{"weekday": TUESDAY, "opens": "12:00", "closes": "20:00"}]))

    assert res.status_code == 200, res.get_json()
    assert res.get_json()["hours"] == [
        {"weekday": TUESDAY, "opens": "12:00", "closes": "20:00"}]


def test_a_day_listed_twice_is_refused(client, ids):
    """Merging them silently would hide a bug in whatever sent it."""
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(hours=[
        {"weekday": MONDAY, "opens": "11:00", "closes": "15:00"},
        {"weekday": MONDAY, "opens": "17:00", "closes": "22:00"},
    ]))

    assert res.status_code == 400
    assert "Monday is listed twice." in res.get_json()["errors"]


def test_a_time_that_is_not_a_time_is_refused(client, ids):
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(
        hours=[{"weekday": MONDAY, "opens": "elevenish", "closes": "22:00"}]))

    assert res.status_code == 400
    assert "Monday" in res.get_json()["errors"][0]


def test_a_weekday_outside_the_week_is_refused(client, ids):
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(
        hours=[{"weekday": 7, "opens": "11:00", "closes": "22:00"}]))

    assert res.status_code == 400
    assert RestaurantHours.query.count() == 0


def test_a_timezone_that_is_not_a_zone_is_refused(client, ids):
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}",
                     json=payload(timezone="Mars/Olympus"))

    assert res.status_code == 400
    assert "America/Chicago" in res.get_json()["errors"][0], "the message shows the shape"


def test_an_owner_can_correct_the_timezone_their_state_suggested(client, ids):
    """Texas is mostly Central, but El Paso is not."""
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}",
                     json=payload(state="TX", timezone="America/Denver"))

    assert res.status_code == 200, res.get_json()
    assert res.get_json()["timezone"] == "America/Denver"


def test_amenities_are_set_and_cleared_like_cuisines(client, ids):
    made = add_amenities(("Offers Takeout", "takeout"), ("Free Wi-Fi", "wifi"))
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}",
                     json=payload(amenity_ids=[made["Free Wi-Fi"]]))
    assert res.status_code == 200, res.get_json()
    assert [item["name"] for item in res.get_json()["amenities"]] == ["Free Wi-Fi"]

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(amenity_ids=[]))
    assert res.get_json()["amenities"] == []


def test_an_amenity_that_does_not_exist_writes_nothing(client, ids):
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}",
                     json=payload(name="Renamed", amenity_ids=[9999]))

    assert res.status_code == 400
    assert db.session.get(Restaurant, ids["restaurant"]).name == "Test Bistro"


def test_someone_elses_restaurant_keeps_its_hours(client, ids):
    give_hours(ids["restaurant"], (MONDAY, (11, 0), (22, 0)))
    login(client, "bystander@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(hours=[]))

    assert res.status_code == 403
    assert RestaurantHours.query.count() == 1


def test_deleting_a_restaurant_takes_its_hours_with_it(client, ids):
    give_hours(ids["restaurant"], (MONDAY, (11, 0), (22, 0)))
    login(client, "owner@test.io")

    assert client.delete(f"/api/restaurants/{ids['restaurant']}").status_code == 200
    assert RestaurantHours.query.count() == 0
