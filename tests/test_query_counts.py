"""
The listing, search, review feeds and profile answer in a fixed number of
queries, however many rows they cover.

Each test counts the statements for a small table, grows the table, and counts
again: the absolute number is nobody's business, but it must not move.
"""
from contextlib import contextmanager

import pytest
from sqlalchemy import event

from app.models import Restaurant, RestaurantImage, Review, User, db
from tests.conftest import login


@contextmanager
def counted():
    """
    Every SQL statement the app runs while the block is open, measured from a
    cold session: a row the test itself just loaded would otherwise be served
    out of the identity map, and the query it saved would go uncounted.
    """
    db.session.remove()
    statements = []

    def record(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    engine = db.engine
    event.listen(engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", record)


def add_restaurants(owner_id, reviewer_id, count):
    """`count` more restaurants, each with one review and one cover photo."""
    for n in range(count):
        restaurant = Restaurant(
            user_id=owner_id, name=f"Extra Diner {n}", price="$", address=f"{n} Side St",
            city="Austin", state="TX", zipcode="78701", country="USA",
            phone_number="(555) 000-0000", website="http://extra.com",
            description="Another one for the pile.")
        db.session.add(restaurant)
        db.session.commit()

        db.session.add(Review(user_id=reviewer_id, restaurant_id=restaurant.id,
                              review=f"Extra review {n}", rating=5))
        db.session.add(RestaurantImage(restaurant_id=restaurant.id, preview=True,
                                       url=f"https://example.com/extra-{n}.jpg",
                                       createdByUserId=reviewer_id))
    db.session.commit()


@pytest.mark.parametrize("url", [
    "/api/restaurants/",
    "/api/restaurants/search/t",       # the short-keyword branch
    "/api/restaurants/search/diner",   # the name-then-other-fields branch
])
def test_listing_queries_do_not_grow_with_the_table(client, ids, url):
    add_restaurants(ids["owner"], ids["reviewer"], 1)
    with counted() as before:
        assert client.get(url).status_code == 200

    add_restaurants(ids["owner"], ids["reviewer"], 8)

    with counted() as after:
        res = client.get(url)
    assert res.status_code == 200
    assert len(res.get_json()["Restaurants"]) >= 8, "the rows really are being served"
    assert len(after) == len(before), "\n".join(after)


def test_a_restaurants_reviews_do_not_cost_a_query_each(client, ids):
    url = f"/api/restaurants/{ids['restaurant']}/reviews"
    with counted() as before:
        assert client.get(url).status_code == 200

    for n in range(5):
        author = User(username=f"guest{n}", email=f"guest{n}@test.io", password="password",
                      first_name="Guest", last_name=str(n))
        db.session.add(author)
        db.session.commit()
        db.session.add(Review(user_id=author.id, restaurant_id=ids["restaurant"],
                              review=f"Guest review {n}", rating=3))
    db.session.commit()

    with counted() as after:
        res = client.get(url)
    assert len(res.get_json()["reviews"]) == 6
    assert len(after) == len(before), "\n".join(after)


def test_a_users_review_feed_does_not_cost_a_query_each(client, ids):
    url = f"/api/reviews/{ids['reviewer']}"
    add_restaurants(ids["owner"], ids["reviewer"], 1)
    with counted() as before:
        assert client.get(url).status_code == 200

    add_restaurants(ids["owner"], ids["reviewer"], 6)

    with counted() as after:
        res = client.get(url)
    assert len(res.get_json()) == 8
    assert len(after) == len(before), "\n".join(after)


def test_a_profile_does_not_cost_a_query_per_business(client, ids):
    url = f"/api/users/get/{ids['owner']}"
    add_restaurants(ids["owner"], ids["reviewer"], 1)
    with counted() as before:
        assert client.get(url).status_code == 200

    add_restaurants(ids["owner"], ids["reviewer"], 8)

    with counted() as after:
        res = client.get(url)
    assert len(res.get_json()["restaurants"]) == 10
    assert len(after) == len(before), "\n".join(after)


def test_the_cards_still_say_what_they_said(client, ids):
    """The rewrite is a query change, not a payload change."""
    login(client, "owner@test.io")
    card = client.get("/api/restaurants/").get_json()["Restaurants"][0]
    assert card["name"] == "Test Bistro"
    assert card["avgRating"] == 4
    assert card["numReviews"] == 1
    assert card["previewImage"] == "https://example.com/a.jpg"
    assert card["oneReview"] == "Solid."

    profile = client.get(f"/api/users/get/{ids['owner']}").get_json()
    assert profile["restaurants"][0]["avgRating"] == 4
    assert profile["restaurants"][0]["numReviews"] == 1
    assert profile["restaurants"][0]["previewImage"] == "https://example.com/a.jpg"
