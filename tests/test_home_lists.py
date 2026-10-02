"""
The two short lists the home page needs that no endpoint served (#134):
the newest reviews on the site, and the cuisines restaurants are listed
under with how many each has.
"""
from datetime import datetime, timedelta

import pytest

from app.models import Category, Restaurant, Review, ReviewResponse, db
from tests.conftest import critics
from tests.test_query_counts import counted


def restaurant_named(owner_id, name):
    restaurant = Restaurant(
        user_id=owner_id, name=name, price="$$", address="1 Side St", city="Austin", state="TX",
        zipcode="78701", country="USA", phone_number="(555) 000-0000", website="http://x.com",
        description="Somewhere to eat.")
    db.session.add(restaurant)
    db.session.commit()
    return restaurant


def reviews_written(ids, count, start=0):
    """`count` reviews of the test restaurant, one a day, the last the newest."""
    base = datetime(2026, 1, 1)
    for n, author in enumerate(critics(count, start=start)):
        db.session.add(Review(user_id=author, restaurant_id=ids["restaurant"], rating=4,
                              review=f"Review {start + n}", createdAt=base + timedelta(days=start + n)))
    db.session.commit()


# --- GET /api/reviews/recent ---------------------------------------------------------

def test_recent_reviews_are_the_newest_with_who_wrote_them_and_where(client, ids):
    reviews_written(ids, 3)

    items = client.get("/api/reviews/recent").get_json()["items"]

    # The fixture's own review was written today, after all of these.
    assert [item["review"] for item in items] == ["Solid.", "Review 2", "Review 1", "Review 0"]
    first = items[1]
    assert first["user"]["username"] == "critic2"
    assert first["restaurant"]["name"] == "Test Bistro"
    assert first["restaurant"]["previewImage"] == "https://example.com/a.jpg"
    assert first["rating"] == 4


def test_six_unless_asked_and_never_more_than_twenty(client, ids):
    reviews_written(ids, 24)

    assert len(client.get("/api/reviews/recent").get_json()["items"]) == 6
    assert len(client.get("/api/reviews/recent?limit=2").get_json()["items"]) == 2
    assert len(client.get("/api/reviews/recent?limit=20").get_json()["items"]) == 20


@pytest.mark.parametrize("limit", ["0", "21", "-1", "two", "2.5"])
def test_a_limit_out_of_range_is_refused(client, limit):
    res = client.get(f"/api/reviews/recent?limit={limit}")
    assert res.status_code == 400
    assert res.get_json()["errors"] == ["limit must be a whole number from 1 to 20"]


def test_a_review_whose_author_has_left_is_still_one_of_them(client, ids):
    review = db.session.get(Review, ids["review"])
    review.user_id = None
    db.session.commit()

    items = client.get("/api/reviews/recent").get_json()["items"]
    assert [(item["review"], item["user"]) for item in items] == [("Solid.", None)]


def test_no_reviews_is_an_empty_list(client, ids):
    db.session.delete(db.session.get(Review, ids["review"]))
    db.session.commit()

    res = client.get("/api/reviews/recent")
    assert res.status_code == 200
    assert res.get_json() == {"items": []}


def test_recent_reviews_do_not_cost_a_query_each(client, ids):
    reviews_written(ids, 1)
    with counted() as before:
        assert client.get("/api/reviews/recent").status_code == 200

    reviews_written(ids, 5, start=1)
    # Replies, which read their author: one batch for all of them too. Each
    # by someone different -- one author for all would be read once anyway.
    reviews = Review.query.all()
    for review, responder in zip(reviews, critics(len(reviews), start=100)):
        db.session.add(ReviewResponse(review_id=review.id, user_id=responder, response="Thanks!"))
    db.session.commit()

    with counted() as after:
        res = client.get("/api/reviews/recent")
    items = res.get_json()["items"]
    assert len(items) == 6
    assert len({item["response"]["user"]["id"] for item in items}) == 6
    assert len(after) == len(before) + 1, "\n".join(after)  # the replies' authors, once


# --- GET /api/categories/popular -----------------------------------------------------

def categorise(restaurant, *names):
    for name in names:
        category = Category.query.filter_by(name=name).first()
        if category is None:
            category = Category(name=name, slug=name.lower().replace(" ", "-"))
            db.session.add(category)
        restaurant.categories.append(category)
    db.session.commit()


def test_popular_cuisines_come_most_used_first_with_their_counts(client, ids):
    bistro = db.session.get(Restaurant, ids["restaurant"])
    taqueria = restaurant_named(ids["owner"], "Taqueria")
    sushi = restaurant_named(ids["owner"], "Sushi Place")
    categorise(bistro, "French", "Wine Bars")
    categorise(taqueria, "Mexican", "Wine Bars")
    categorise(sushi, "Japanese", "Wine Bars", "Mexican")
    db.session.add(Category(name="Vegan", slug="vegan"))  # nobody's yet
    db.session.commit()

    items = client.get("/api/categories/popular").get_json()["items"]

    assert [(item["name"], item["restaurantCount"]) for item in items] == [
        ("Wine Bars", 3), ("Mexican", 2), ("French", 1), ("Japanese", 1),
    ]
    assert items[0]["slug"] == "wine-bars"


def test_popular_cuisines_take_a_limit(client, ids):
    bistro = db.session.get(Restaurant, ids["restaurant"])
    categorise(bistro, "French", "Wine Bars", "Japanese")

    assert len(client.get("/api/categories/popular?limit=2").get_json()["items"]) == 2
    res = client.get("/api/categories/popular?limit=51")
    assert res.status_code == 400
    assert res.get_json()["errors"] == ["limit must be a whole number from 1 to 50"]


def test_no_cuisine_in_use_is_an_empty_list(client):
    res = client.get("/api/categories/popular")
    assert res.status_code == 200
    assert res.get_json() == {"items": []}
