"""
Categories on the way in (what a create or edit may set) and on the way out
(what a card and a detail page show).
"""

# Yelp shows three, and three is about what a reader can take in from a card.
# It is also what stops a restaurant from claiming every cuisine there is and
# turning up under every filter.
MAX_CATEGORIES = 3


def categories_by_restaurant(restaurant_ids):
    """
    {restaurant_id: [category dict, ...]} for the given restaurants, in one
    query -- the batch shape every card helper uses, for the same reason.
    """
    from app.models import Category, db, restaurant_categories

    ids = list(restaurant_ids)
    if not ids:
        return {}

    rows = db.session.query(restaurant_categories.c.restaurant_id, Category).join(
        Category, Category.id == restaurant_categories.c.category_id
    ).filter(
        restaurant_categories.c.restaurant_id.in_(ids)
    ).order_by(Category.name).all()

    grouped = {}
    for restaurant_id, category in rows:
        grouped.setdefault(restaurant_id, []).append(category.to_dict())
    return grouped


def read_categories(payload):
    """
    (categories, error) for the `category_ids` in a create or edit body.

    A body without the key gives back None, which means "leave them alone":
    every client written before this feature sends exactly that, and an edit
    from one must not quietly strip a restaurant's cuisines. An empty list is
    a request to clear them, and is honoured.
    """
    from app.models import Category

    if not isinstance(payload, dict) or payload.get("category_ids") is None:
        return None, None

    raw = payload["category_ids"]
    if not isinstance(raw, list):
        return None, "category_ids must be a list of category ids."

    ids = []
    for value in raw:
        # bool is an int in Python, and `true` is not a category.
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            return None, "Each category must be chosen from the list."
        try:
            ids.append(int(value))
        except ValueError:
            return None, "Each category must be chosen from the list."

    ids = list(dict.fromkeys(ids))
    if len(ids) > MAX_CATEGORIES:
        return None, f"Choose at most {MAX_CATEGORIES} categories."
    if not ids:
        return [], None

    found = Category.query.filter(Category.id.in_(ids)).all()
    if len(found) != len(ids):
        return None, "Each category must be chosen from the list."
    return found, None
