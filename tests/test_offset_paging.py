"""
Asking for what comes after the items a page still has (#113).

Page numbers assume the list holds still. The Saved tab does not: unsave a
restaurant on page 1 and everything after it moves up one, so page 2 starts
one later than it did, and the restaurant that moved up is never shown.
Deleting your own review under a restaurant does the same to its reviews.
`offset` -- "skip the N I have" -- cannot miss it.
"""
import pytest

from app.api.utils import MAX_OFFSET
from app.models import Restaurant, Review, User, db
from tests.conftest import login
from tests.test_favorites import save, saved_list, unsave
from tests.test_pagination import add_restaurants, extra_reviews


def item_ids(res):
    assert res.status_code == 200, res.get_json()
    return [item["id"] for item in res.get_json()["items"]]


# --- the parameter ---------------------------------------------------------------

def test_an_offset_skips_that_many(client, ids):
    add_restaurants(ids["owner"], 9)
    everything = item_ids(client.get("/api/restaurants/?per_page=10"))

    assert item_ids(client.get("/api/restaurants/?offset=0&per_page=4")) == everything[:4]
    assert item_ids(client.get("/api/restaurants/?offset=3&per_page=4")) == everything[3:7]
    assert item_ids(client.get("/api/restaurants/?offset=8&per_page=4")) == everything[8:]


def test_the_envelope_says_where_it_started(client, ids):
    add_restaurants(ids["owner"], 9)
    body = client.get("/api/restaurants/?offset=5&per_page=2").get_json()
    assert body["offset"] == 5
    assert body["page"] == 3  # the page offset 5 falls in, at two a page
    assert body["total"] == 10

    # A page request says where its page starts, too.
    assert client.get("/api/restaurants/?page=3&per_page=2").get_json()["offset"] == 4


def test_an_offset_past_the_end_is_empty(client, ids):
    body = client.get("/api/restaurants/?offset=50").get_json()
    assert body["items"] == []
    assert body["total"] == 1


@pytest.mark.parametrize("query, message", [
    ("offset=-1", "offset must be 0 or more"),
    ("offset=two", "offset must be a whole number"),
    ("offset=1.5", "offset must be a whole number"),
    (f"offset={MAX_OFFSET + 1}", f"offset must be {MAX_OFFSET} or less"),
    ("offset=99999999999999999999", f"offset must be {MAX_OFFSET} or less"),
    ("offset=2&page=2", "Send page or offset, not both"),
])
def test_an_offset_that_is_not_one_is_a_400(client, query, message):
    res = client.get(f"/api/restaurants/?{query}")
    assert res.status_code == 400, query
    assert res.get_json()["errors"] == [message]


# --- the Saved tab ---------------------------------------------------------------

def test_unsaving_on_the_first_page_does_not_hide_one_from_the_next(client, ids):
    """25 saved and two unsaved from page 1: page 2 skips two, an offset skips none."""
    add_restaurants(ids["owner"], 24)
    login(client, "bystander@test.io")
    for restaurant in Restaurant.query.order_by(Restaurant.id).all():
        save(client, restaurant.id)
    before = item_ids(saved_list(client, ids["bystander"], "?per_page=50"))
    assert len(before) == 25

    first_page = item_ids(saved_list(client, ids["bystander"], "?per_page=20"))
    for restaurant_id in first_page[:2]:
        assert unsave(client, restaurant_id).status_code == 200
    still_shown = first_page[2:]

    rest = item_ids(saved_list(client, ids["bystander"], f"?offset={len(still_shown)}&per_page=20"))

    assert still_shown + rest == [rid for rid in before if rid not in first_page[:2]]
    # Page 2 by number starts two late: the two that moved up are never shown.
    assert item_ids(saved_list(client, ids["bystander"], "?page=2&per_page=20")) == rest[2:]


# --- a restaurant's reviews ---------------------------------------------------------

def test_a_deleted_review_does_not_hide_one_from_the_next_page(client, ids):
    extra_reviews(ids["restaurant"], [3, 4, 5, 2, 1])
    url = f"/api/restaurants/{ids['restaurant']}/reviews"
    before = item_ids(client.get(f"{url}?per_page=10"))
    first_page = item_ids(client.get(f"{url}?per_page=3"))

    author = db.session.get(Review, first_page[0]).user_id
    email = db.session.get(User, author).email
    login(client, email)
    assert client.delete(f"/api/reviews/{first_page[0]}").status_code == 200
    still_shown = first_page[1:]

    rest = item_ids(client.get(f"{url}?offset={len(still_shown)}&per_page=3"))
    assert still_shown + rest == before[1:]


# --- the reader's own review first ---------------------------------------------------

def test_your_own_review_comes_first_in_every_order(client, ids):
    """The restaurant page pins it to the top, so the API puts it there."""
    extra_reviews(ids["restaurant"], [5, 1, 3, 2, 5])  # all newer than the seeded one
    url = f"/api/restaurants/{ids['restaurant']}/reviews"
    login(client, "reviewer@test.io")

    for sort in ("newest", "highest", "lowest"):
        plain = item_ids(client.get(f"{url}?sort={sort}&per_page=10"))
        pinned = item_ids(client.get(f"{url}?sort={sort}&mine=first&per_page=10"))
        assert pinned[0] == ids["review"], sort
        # The rest keep the order asked for.
        assert pinned[1:] == [rid for rid in plain if rid != ids["review"]], sort


def test_paging_past_your_review_shows_it_once(client, ids):
    extra_reviews(ids["restaurant"], [5, 1, 3, 2, 5])
    url = f"/api/restaurants/{ids['restaurant']}/reviews?mine=first&per_page=2"
    login(client, "reviewer@test.io")

    pages = [item_ids(client.get(f"{url}&offset={offset}")) for offset in (0, 2, 4)]
    everything = pages[0] + pages[1] + pages[2]
    assert everything[0] == ids["review"]
    assert len(set(everything)) == len(everything) == 6


def test_mine_first_changes_nothing_for_someone_without_a_review(client, ids):
    extra_reviews(ids["restaurant"], [5, 1, 3])
    url = f"/api/restaurants/{ids['restaurant']}/reviews"
    assert item_ids(client.get(f"{url}?mine=first")) == item_ids(client.get(url))  # signed out
    login(client, "bystander@test.io")
    assert item_ids(client.get(f"{url}?mine=first")) == item_ids(client.get(url))


def test_mine_takes_only_first(client, ids):
    res = client.get(f"/api/restaurants/{ids['restaurant']}/reviews?mine=last")
    assert res.status_code == 400
    assert res.get_json()["errors"] == ["mine can only be first"]
