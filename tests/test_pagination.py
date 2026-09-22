"""
The list and the reviews feed answer with a page, not the table.

Every paginated route uses the same envelope -- items, page, per_page, total
-- so a caller reads one shape and the UI can say "24 of 61" without a second
request.
"""
import pytest

from app.api.utils import DEFAULT_PER_PAGE, MAX_PER_PAGE
from app.models import Restaurant, Review, User, db
from tests.conftest import login


def add_restaurants(owner_id, count, prefix="Extra"):
    db.session.add_all([
        Restaurant(user_id=owner_id, name=f"{prefix} {n:03}", price="$", address=f"{n} Side St",
                   city="Austin", state="TX", zipcode="78701", country="USA",
                   phone_number="(555) 000-0000", website="http://extra.com",
                   description="One of many.")
        for n in range(count)
    ])
    db.session.commit()


def test_the_listing_answers_with_a_page(client, ids):
    add_restaurants(ids["owner"], 24)
    body = client.get("/api/restaurants/").get_json()

    assert body["page"] == 1
    assert body["per_page"] == DEFAULT_PER_PAGE
    assert body["total"] == 25
    assert len(body["items"]) == DEFAULT_PER_PAGE


def test_the_second_page_continues_where_the_first_stopped(client, ids):
    add_restaurants(ids["owner"], 24)
    first = client.get("/api/restaurants/?per_page=10").get_json()
    second = client.get("/api/restaurants/?per_page=10&page=2").get_json()

    first_ids = [item["id"] for item in first["items"]]
    second_ids = [item["id"] for item in second["items"]]
    assert len(first_ids) == len(second_ids) == 10
    assert not set(first_ids) & set(second_ids), "a row must not appear on two pages"
    assert first_ids + second_ids == sorted(first_ids + second_ids), "stable order"


def test_a_page_past_the_end_is_empty_rather_than_an_error(client, ids):
    body = client.get("/api/restaurants/?page=99").get_json()
    assert body["items"] == []
    assert body["total"] == 1


def test_asking_for_too_many_gets_the_maximum_and_is_told_so(client, ids):
    add_restaurants(ids["owner"], 60)
    body = client.get("/api/restaurants/?per_page=500").get_json()
    assert body["per_page"] == MAX_PER_PAGE
    assert len(body["items"]) == MAX_PER_PAGE


@pytest.mark.parametrize("query", ["page=0", "page=-1", "page=two", "per_page=0", "per_page=x"])
def test_a_page_that_is_not_a_page_is_a_400(client, query):
    res = client.get(f"/api/restaurants/?{query}")
    assert res.status_code == 400, query
    assert res.get_json()["errors"], query


def test_search_pages_the_same_way(client, ids):
    add_restaurants(ids["owner"], 24, prefix="Searchable")
    body = client.get("/api/restaurants/search/searchable?per_page=10").get_json()

    assert body["total"] == 24
    assert len(body["items"]) == 10
    assert body["page"] == 1


def extra_reviews(restaurant_id, ratings):
    for index, rating in enumerate(ratings):
        author = User(username=f"critic{index}", email=f"critic{index}@test.io",
                      password="password", first_name="C", last_name=str(index))
        db.session.add(author)
        db.session.commit()
        db.session.add(Review(user_id=author.id, restaurant_id=restaurant_id,
                              review=f"Review scoring {rating}", rating=rating))
    db.session.commit()


def test_reviews_answer_with_a_page(client, ids):
    extra_reviews(ids["restaurant"], [1, 2, 3])
    body = client.get(f"/api/restaurants/{ids['restaurant']}/reviews?per_page=2").get_json()

    assert body["total"] == 4  # three plus the seeded one
    assert len(body["items"]) == 2


def test_reviews_sort_highest_and_lowest(client, ids):
    extra_reviews(ids["restaurant"], [1, 5, 3])

    highest = client.get(f"/api/restaurants/{ids['restaurant']}/reviews?sort=highest").get_json()
    assert [review["rating"] for review in highest["items"]] == [5, 4, 3, 1]

    lowest = client.get(f"/api/restaurants/{ids['restaurant']}/reviews?sort=lowest").get_json()
    assert [review["rating"] for review in lowest["items"]] == [1, 3, 4, 5]


def test_reviews_default_to_newest(client, ids):
    extra_reviews(ids["restaurant"], [1, 5])
    body = client.get(f"/api/restaurants/{ids['restaurant']}/reviews").get_json()
    ids_in_order = [review["id"] for review in body["items"]]
    assert ids_in_order == sorted(ids_in_order, reverse=True), "newest first"


def test_an_unknown_sort_is_refused(client, ids):
    res = client.get(f"/api/restaurants/{ids['restaurant']}/reviews?sort=funniest")
    assert res.status_code == 400
    assert "sort must be one of" in res.get_json()["errors"][0]


def test_sorted_pages_do_not_repeat_a_review(client, ids):
    """Equal ratings need a tie-break or paging by rating reshuffles them."""
    extra_reviews(ids["restaurant"], [4, 4, 4, 4])

    first = client.get(f"/api/restaurants/{ids['restaurant']}/reviews?sort=highest&per_page=2").get_json()
    second = client.get(f"/api/restaurants/{ids['restaurant']}/reviews?sort=highest&per_page=2&page=2").get_json()

    seen = [review["id"] for review in first["items"] + second["items"]]
    assert len(seen) == len(set(seen)) == 4
