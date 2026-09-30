"""
One city, however it was typed (#128).

A city was saved as typed. The list of cities returned each spelling, so
"HOUSTON", "Houston", "Houston " and "houston" were four entries, and the
filter compared case but not the spaces around it, so ?city=Houston never
found the one saved with a trailing space.
"""
import importlib.util
import pathlib

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.api.restaurant_routes import one_spelling_per_city
from app.models import Restaurant, db
from tests.conftest import login


def add_restaurant(owner_id, name, city):
    restaurant = Restaurant(
        user_id=owner_id, name=name, price="$", address="1 Any St", city=city, state="TX",
        zipcode="77002", country="USA", phone_number="(555) 555-0000",
        website="http://example.com", description="A place.")
    db.session.add(restaurant)
    db.session.commit()
    return restaurant.id


def payload(**overrides):
    body = {
        "name": "New Place", "price": "$$", "address": "3 High St", "city": "Austin",
        "state": "TX", "zipcode": "78701", "country": "USA", "phone_number": "(555) 111-2222",
        "website": "http://newplace.com", "description": "Freshly opened.",
    }
    body.update(overrides)
    return body


def houston_four_ways(ids):
    # The test restaurant is "Houston" already; three more spellings of it.
    for name, city in (("Loud", "HOUSTON"), ("Spaced", "Houston "), ("Quiet", "houston")):
        add_restaurant(ids["owner"], name, city)


# --- the list of cities ---------------------------------------------------------------

def test_spellings_of_one_city_are_one_entry(client, ids):
    houston_four_ways(ids)
    add_restaurant(ids["owner"], "Elsewhere", "Austin")

    assert client.get("/api/restaurants/cities").get_json()["items"] == ["Austin", "Houston"]


def test_the_commonest_spelling_is_the_one_shown():
    assert one_spelling_per_city([("HOUSTON", 3), ("Houston", 1)]) == ["HOUSTON"]


def test_a_tie_goes_to_title_case_then_the_alphabet():
    assert one_spelling_per_city([("houston", 1), ("Houston", 1), ("HOUSTON", 1)]) == ["Houston"]
    assert one_spelling_per_city([("dallas", 1), ("DALLAS", 1)]) == ["DALLAS"]


def test_the_spaces_around_a_spelling_are_not_shown():
    assert one_spelling_per_city([("Houston  ", 2), ("Houston", 1)]) == ["Houston"]


def test_a_blank_city_is_not_a_city():
    assert one_spelling_per_city([("   ", 1), ("", 1), (None, 1), ("Waco", 1)]) == ["Waco"]


def test_cities_are_listed_whatever_their_case():
    assert one_spelling_per_city([("austin", 1), ("Boston", 1), ("aberdeen", 1)]) == ["aberdeen", "austin", "Boston"]


# --- the filter -----------------------------------------------------------------------

def test_the_filter_finds_every_spelling(client, ids):
    houston_four_ways(ids)

    for asked in ("Houston", "HOUSTON", " houston "):
        body = client.get("/api/restaurants/", query_string={"city": asked}).get_json()
        assert body["total"] == 4, (asked, [item["name"] for item in body["items"]])


# --- what is saved --------------------------------------------------------------------

def test_a_new_restaurant_is_saved_trimmed(client, ids):
    login(client, "owner@test.io")

    res = client.post("/api/restaurants/", json=payload(name="  New Place  ", city=" Austin ", address=" 3 High St "))

    assert res.status_code == 200, res.get_json()
    saved = db.session.get(Restaurant, res.get_json()["id"])
    assert (saved.name, saved.city, saved.address) == ("New Place", "Austin", "3 High St")


def test_an_edit_is_saved_trimmed(client, ids):
    login(client, "owner@test.io")

    res = client.put(f"/api/restaurants/{ids['restaurant']}", json=payload(city="Dallas  "))

    assert res.status_code == 200, res.get_json()
    assert db.session.get(Restaurant, ids["restaurant"]).city == "Dallas"


def test_a_name_of_spaces_is_no_name(client, ids):
    login(client, "owner@test.io")

    res = client.post("/api/restaurants/", json=payload(name="   "))

    assert res.status_code == 400
    assert "Restaurant name is required." in res.get_json()["errors"]


def test_a_new_city_is_listed_as_soon_as_it_exists(client, ids):
    login(client, "owner@test.io")
    assert "Austin" not in client.get("/api/restaurants/cities").get_json()["items"]

    client.post("/api/restaurants/", json=payload(city="Austin"))

    assert "Austin" in client.get("/api/restaurants/cities").get_json()["items"]


# --- the cities saved before ------------------------------------------------------------

MIGRATION = (pathlib.Path(__file__).resolve().parents[1]
             / "migrations" / "versions" / "a9c4e2b7d315_trim_restaurant_cities.py")


def run_upgrade(cities):
    spec = importlib.util.spec_from_file_location("trim_cities", MIGRATION)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE restaurants (id INTEGER PRIMARY KEY, city VARCHAR(50))"))
        for city in cities:
            connection.execute(sa.text("INSERT INTO restaurants (city) VALUES (:city)"), {"city": city})
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        return [city for (city,) in connection.execute(sa.text("SELECT city FROM restaurants ORDER BY id"))]


def test_the_migration_trims_the_cities_saved_before():
    assert run_upgrade(["Houston ", "  Austin", "Waco", " El Paso  "]) == ["Houston", "Austin", "Waco", "El Paso"]


def test_the_migration_leaves_each_owners_case_alone():
    assert run_upgrade(["HOUSTON ", "houston"]) == ["HOUSTON", "houston"]
