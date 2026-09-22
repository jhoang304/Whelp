"""
The filters the listing and the search both take, and the query they build.

Both pages ask the same questions -- which price, which cuisine, how well
reviewed, which city, in what order -- so they read them in one place and get
the same answers, including the same rejections for a filter nobody offers.
"""
from flask import request
from sqlalchemy import func

PRICES = ("$", "$$", "$$$", "$$$$", "$$$$$")
SORTS = ("rating", "reviews", "newest")
MAX_RATING = 5


class FilterRequest:
    """What a caller asked the listing to narrow to, or why it is not a filter."""

    def __init__(self, category=None, category_id=None, prices=(), min_rating=None,
                 city=None, sort=None, error=None):
        self.category = category
        self.category_id = category_id
        self.prices = tuple(prices)
        self.min_rating = min_rating
        self.city = city
        self.sort = sort
        self.error = error

def _values(args, name):
    """
    Every value of a repeated parameter: ?price=$&price=$$ is two prices.

    Repeated rather than comma-separated because that is what a form and
    URLSearchParams both produce, and what a reader of the URL expects.
    """
    if hasattr(args, "getlist"):
        return [value for value in args.getlist(name) if value != ""]
    value = args.get(name)
    return [value] if value else []


def read_filters(args=None):
    """
    Read `category`, `price`, `min_rating`, `city` and `sort` off the query
    string, or return the first thing wrong with them.

    A filter nobody offers is a mistake worth saying out loud: a typo'd
    category answered with the unfiltered listing looks like a restaurant that
    has gone missing, not like a bad URL.
    """
    args = request.args if args is None else args

    category_id = None
    category = (args.get("category") or "").strip()
    if category:
        from app.models import Category

        found = Category.query.filter(
            func.lower(Category.slug) == category.lower()).first()
        if found is None:
            return FilterRequest(error=f"there is no category called '{category}'")
        category_id = found.id

    prices = _values(args, "price")
    for price in prices:
        if price not in PRICES:
            return FilterRequest(error=f"price must be one of: {', '.join(PRICES)}")

    min_rating = None
    raw_rating = args.get("min_rating")
    if raw_rating not in (None, ""):
        try:
            min_rating = float(raw_rating)
        except ValueError:
            return FilterRequest(error="min_rating must be a number")
        if not 0 <= min_rating <= MAX_RATING:
            return FilterRequest(error=f"min_rating must be between 0 and {MAX_RATING}")

    sort = (args.get("sort") or "").strip() or None
    if sort and sort not in SORTS:
        return FilterRequest(error=f"sort must be one of: {', '.join(SORTS)}")

    return FilterRequest(
        category=category or None,
        category_id=category_id,
        prices=prices,
        min_rating=min_rating,
        city=(args.get("city") or "").strip() or None,
        sort=sort,
    )


def filtered_restaurants(filters, base=None, relevance=None):
    """
    The ordered query the listing and the search both page through.

    `base` is the search's keyword match, and `relevance` its ordering -- the
    part that is the search's own business. Everything else is shared, so a
    filter added here reaches both pages at once.
    """
    from app.models import Restaurant, Review, db, restaurant_categories

    query = Restaurant.query if base is None else base

    if filters.category_id is not None:
        # (restaurant_id, category_id) is the primary key, so joining on one
        # category matches each restaurant at most once and the page keeps
        # counting rows the way it did before.
        query = query.join(
            restaurant_categories,
            restaurant_categories.c.restaurant_id == Restaurant.id,
        ).filter(restaurant_categories.c.category_id == filters.category_id)

    if filters.prices:
        query = query.filter(Restaurant.price.in_(filters.prices))

    if filters.city:
        query = query.filter(func.lower(Restaurant.city) == filters.city.lower())

    order = []

    if filters.min_rating is not None or filters.sort in ("rating", "reviews"):
        stats = db.session.query(
            Review.restaurant_id.label("restaurant_id"),
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.id).label("num_reviews"),
        ).group_by(Review.restaurant_id).subquery()
        query = query.outerjoin(stats, stats.c.restaurant_id == Restaurant.id)

        # One aggregate over the whole table, joined once -- not a rating read
        # per row. A restaurant nobody has reviewed rates 0 rather than
        # dropping out of an inner join, so min_rating=0 really does mean
        # "everything" and min_rating=1 is how you ask for reviewed ones.
        if filters.min_rating is not None:
            query = query.filter(
                func.coalesce(stats.c.avg_rating, 0) >= filters.min_rating)
        if filters.sort == "rating":
            order.append(func.coalesce(stats.c.avg_rating, 0).desc())
        elif filters.sort == "reviews":
            order.append(func.coalesce(stats.c.num_reviews, 0).desc())

    if filters.sort == "newest":
        order.append(Restaurant.createdAt.desc())
    elif relevance is not None and filters.sort is None:
        # Relevance is the search's own order. An explicit sort replaces it:
        # asking for "highest rated" and getting name matches first would look
        # like the sort was ignored.
        order.append(relevance)

    # Every order ends in id. Without a total order the database is free to
    # return equal rows in any order it likes, and two pages of the same
    # query can then repeat a restaurant or skip one.
    return query.order_by(*order, Restaurant.id)
