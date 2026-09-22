"""
Narrowing the listing and the search: by cuisine, price, rating and city, in
the order the caller asked for.

Both pages read their filters through app.api.filters, so each of these holds
for /api/restaurants and /api/restaurants/search alike; the tests that would
say the same thing twice check the search only where it differs.
"""
from datetime import datetime

import pytest

from app.models import Category, Restaurant, Review, db


def add_restaurant(owner_id, name, price="$", city="Austin", ratings=(),
                   categories=(), created=None, description="One of many."):
    """A restaurant, its reviews and its cuisines, by name."""
    restaurant = Restaurant(
        user_id=owner_id, name=name, price=price, address="1 Side St", city=city,
        state="TX", zipcode="78701", country="USA", phone_number="(555) 000-0000",
        website="http://extra.com", description=description)
    db.session.add(restaurant)
    db.session.commit()

    for number, rating in enumerate(ratings):
        db.session.add(Review(user_id=owner_id, restaurant_id=restaurant.id,
                              review=f"Review {number} of {name}", rating=rating))
    if categories:
        restaurant.categories = Category.query.filter(Category.slug.in_(categories)).all()
    if created is not None:
        restaurant.createdAt = created
    db.session.commit()
    return restaurant.id


def add_categories(*pairs):
    db.session.add_all([Category(name=name, slug=slug) for name, slug in pairs])
    db.session.commit()


def names(response):
    assert response.status_code == 200, response.get_json()
    return [item["name"] for item in response.get_json()["items"]]


def test_a_category_narrows_the_listing(client, ids):
    add_categories(("Pizza", "pizza"), ("Sushi Bars", "sushi-bars"))
    add_restaurant(ids["owner"], "Pizza Place", categories=["pizza"])
    add_restaurant(ids["owner"], "Sushi Place", categories=["sushi-bars"])

    assert names(client.get("/api/restaurants/?category=pizza")) == ["Pizza Place"]


def test_a_category_nobody_offers_is_a_400_that_names_it(client, ids):
    """
    A typo answered with the unfiltered listing reads as a restaurant that has
    gone missing, not as a bad URL.
    """
    res = client.get("/api/restaurants/?category=klingon")

    assert res.status_code == 400
    assert res.get_json()["errors"] == ["there is no category called 'klingon'"]


def test_a_category_slug_is_matched_whatever_its_case(client, ids):
    add_categories(("Sushi Bars", "sushi-bars"))
    add_restaurant(ids["owner"], "Sushi Place", categories=["sushi-bars"])

    assert names(client.get("/api/restaurants/?category=Sushi-Bars")) == ["Sushi Place"]


def test_price_takes_more_than_one(client, ids):
    add_restaurant(ids["owner"], "Cheap", price="$")
    add_restaurant(ids["owner"], "Middling", price="$$$")
    add_restaurant(ids["owner"], "Dear", price="$$$$")

    # Test Bistro, from the fixture, is $$ and must not come back.
    assert sorted(names(client.get("/api/restaurants/?price=$&price=$$$"))) == ["Cheap", "Middling"]


def test_a_price_that_is_not_one_of_the_five_is_a_400(client, ids):
    res = client.get("/api/restaurants/?price=cheap")

    assert res.status_code == 400
    assert res.get_json()["errors"] == ["price must be one of: $, $$, $$$, $$$$, $$$$$"]


def test_min_rating_drops_the_lower_rated_and_the_unrated(client, ids):
    add_restaurant(ids["owner"], "Adored", ratings=(5, 5))
    add_restaurant(ids["owner"], "Panned", ratings=(1, 2))
    add_restaurant(ids["owner"], "Unknown")

    # Test Bistro, from the fixture, averages 4.
    assert sorted(names(client.get("/api/restaurants/?min_rating=4"))) == ["Adored", "Test Bistro"]


def test_min_rating_zero_still_includes_a_restaurant_nobody_reviewed(client, ids):
    """An unreviewed restaurant rates 0 rather than dropping out of a join."""
    add_restaurant(ids["owner"], "Unknown")

    assert sorted(names(client.get("/api/restaurants/?min_rating=0"))) == ["Test Bistro", "Unknown"]


def test_min_rating_takes_halves(client, ids):
    add_restaurant(ids["owner"], "Nearly", ratings=(4, 5))  # averages 4.5

    assert sorted(names(client.get("/api/restaurants/?min_rating=4.5"))) == ["Nearly"]


@pytest.mark.parametrize("query,message", [
    ("min_rating=great", "min_rating must be a number"),
    ("min_rating=6", "min_rating must be between 0 and 5"),
    ("min_rating=-1", "min_rating must be between 0 and 5"),
    ("sort=alphabetical", "sort must be one of: rating, reviews, newest"),
])
def test_a_filter_the_api_does_not_offer_is_a_400(client, ids, query, message):
    res = client.get(f"/api/restaurants/?{query}")

    assert res.status_code == 400
    assert res.get_json()["errors"] == [message]


def test_city_is_matched_whole_and_whatever_its_case(client, ids):
    add_restaurant(ids["owner"], "Dallas Diner", city="Dallas")
    add_restaurant(ids["owner"], "Houston Heights Cafe", city="Houston Heights")

    # Test Bistro is in Houston; "Houston Heights" is a different city.
    assert names(client.get("/api/restaurants/?city=houston")) == ["Test Bistro"]


def test_sort_by_rating_puts_the_best_first_and_the_unreviewed_last(client, ids):
    add_restaurant(ids["owner"], "Adored", ratings=(5, 5))
    add_restaurant(ids["owner"], "Panned", ratings=(1,))
    add_restaurant(ids["owner"], "Unknown")

    assert names(client.get("/api/restaurants/?sort=rating")) == [
        "Adored", "Test Bistro", "Panned", "Unknown"]


def test_sort_by_reviews_counts_them_rather_than_averaging(client, ids):
    add_restaurant(ids["owner"], "Busy", ratings=(1, 1, 1))
    add_restaurant(ids["owner"], "Adored", ratings=(5,))

    assert names(client.get("/api/restaurants/?sort=reviews"))[0] == "Busy"


def test_sort_by_newest_reads_created_at_not_the_id(client, ids):
    """The seeds set createdAt independently of insert order, and so may an import."""
    db.session.get(Restaurant, ids["restaurant"]).createdAt = datetime(2020, 6, 1)
    db.session.commit()
    add_restaurant(ids["owner"], "Old Timer", created=datetime(2019, 1, 1))
    add_restaurant(ids["owner"], "Just Opened", created=datetime(2024, 1, 1))

    assert names(client.get("/api/restaurants/?sort=newest")) == [
        "Just Opened", "Test Bistro", "Old Timer"]


def test_filters_combine(client, ids):
    add_categories(("Pizza", "pizza"))
    add_restaurant(ids["owner"], "Cheap Slice", price="$", categories=["pizza"], ratings=(5,))
    add_restaurant(ids["owner"], "Posh Slice", price="$$$$", categories=["pizza"], ratings=(5,))
    add_restaurant(ids["owner"], "Cheap Burger", price="$", ratings=(5,))

    assert names(client.get(
        "/api/restaurants/?category=pizza&price=$&min_rating=4")) == ["Cheap Slice"]


def test_a_filtered_page_counts_what_it_filtered(client, ids):
    """
    `total` is what "20 of 61" reads: the unfiltered count would promise rows
    the next page cannot produce.
    """
    add_categories(("Pizza", "pizza"))
    for number in range(3):
        add_restaurant(ids["owner"], f"Slice {number}", categories=["pizza"])
    add_restaurant(ids["owner"], "Not Pizza")

    body = client.get("/api/restaurants/?category=pizza&per_page=2").get_json()

    assert body["total"] == 3
    assert len(body["items"]) == 2


def test_paging_a_filtered_listing_repeats_nothing(client, ids):
    add_categories(("Pizza", "pizza"))
    for number in range(5):
        add_restaurant(ids["owner"], f"Slice {number}", categories=["pizza"], ratings=(4,))

    first = client.get("/api/restaurants/?category=pizza&sort=rating&per_page=3").get_json()
    second = client.get("/api/restaurants/?category=pizza&sort=rating&per_page=3&page=2").get_json()

    got = [item["id"] for item in first["items"]] + [item["id"] for item in second["items"]]
    assert len(got) == len(set(got)) == 5


def test_the_search_takes_the_same_filters(client, ids):
    add_categories(("Pizza", "pizza"))
    add_restaurant(ids["owner"], "Austin Pizza", categories=["pizza"])
    add_restaurant(ids["owner"], "Austin Burgers")

    body = client.get("/api/restaurants/search/austin?category=pizza").get_json()

    assert [item["name"] for item in body["items"]] == ["Austin Pizza"]
    assert body["total"] == 1


def test_the_search_puts_name_matches_before_mere_mentions(client, ids):
    add_restaurant(ids["owner"], "Corner Diner", description="We serve tacos.")
    add_restaurant(ids["owner"], "Tacos Deluxe", description="Nothing to see.")

    assert names(client.get("/api/restaurants/search/tacos")) == [
        "Tacos Deluxe", "Corner Diner"]


def test_the_search_finds_a_cuisine_nobody_wrote_down(client, ids):
    """
    The empty-results page has always suggested searching for "Italian", and
    until there was somewhere to record it that only worked on the owners who
    happened to type the word into their description.
    """
    add_categories(("Italian", "italian"))
    add_restaurant(ids["owner"], "Da Vincenzo", description="Pasta, and plenty of it.",
                   categories=["italian"])

    assert names(client.get("/api/restaurants/search/italian")) == ["Da Vincenzo"]


def test_a_cuisine_match_ranks_below_a_name_and_above_a_mention(client, ids):
    add_categories(("Italian", "italian"))
    add_restaurant(ids["owner"], "Mentions It", description="Not very italian, honestly.")
    add_restaurant(ids["owner"], "Serves It", description="Pasta.", categories=["italian"])
    add_restaurant(ids["owner"], "Italian Kitchen", description="Pasta.")

    assert names(client.get("/api/restaurants/search/italian")) == [
        "Italian Kitchen", "Serves It", "Mentions It"]


def test_an_explicit_sort_replaces_the_searchs_own_order(client, ids):
    """
    Asking for "highest rated" and getting name matches first would look like
    the sort had been ignored.
    """
    add_restaurant(ids["owner"], "Tacos Deluxe", description="Nothing to see.", ratings=(1,))
    add_restaurant(ids["owner"], "Corner Diner", description="We serve tacos.", ratings=(5,))

    assert names(client.get("/api/restaurants/search/tacos?sort=rating")) == [
        "Corner Diner", "Tacos Deluxe"]


def test_a_filter_the_search_does_not_offer_is_a_400_there_too(client, ids):
    res = client.get("/api/restaurants/search/austin?price=cheap")

    assert res.status_code == 400
    assert res.get_json()["errors"] == ["price must be one of: $, $$, $$$, $$$$, $$$$$"]


def test_the_cities_are_the_ones_with_a_restaurant_in_them(client, ids):
    """What the filter bar offers, since the city filter matches a whole name."""
    add_restaurant(ids["owner"], "Dallas Diner", city="Dallas")
    add_restaurant(ids["owner"], "Dallas Deli", city="Dallas")

    res = client.get("/api/restaurants/cities")

    assert res.status_code == 200
    assert res.get_json()["items"] == ["Dallas", "Houston"], "sorted, and each one once"


def test_an_unfiltered_listing_is_unchanged(client, ids):
    """The filters are all optional, and none of them is on by default."""
    add_restaurant(ids["owner"], "Another One")

    assert sorted(names(client.get("/api/restaurants/"))) == ["Another One", "Test Bistro"]
