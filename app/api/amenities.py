"""
Amenities on the way in (what an edit may set) and on the way out (what a
card and a detail page show). The same shape as categories, for the same
reasons.
"""


def amenities_by_restaurant(restaurant_ids):
    """{restaurant_id: [amenity dict, ...]} for the given restaurants, in one query."""
    from app.models import Amenity, db, restaurant_amenities

    ids = list(restaurant_ids)
    if not ids:
        return {}

    rows = db.session.query(restaurant_amenities.c.restaurant_id, Amenity).join(
        Amenity, Amenity.id == restaurant_amenities.c.amenity_id
    ).filter(
        restaurant_amenities.c.restaurant_id.in_(ids)
    ).order_by(Amenity.name).all()

    grouped = {}
    for restaurant_id, amenity in rows:
        grouped.setdefault(restaurant_id, []).append(amenity.to_dict())
    return grouped


def read_amenities(payload):
    """
    (amenities, error) for the `amenity_ids` in an edit body.

    None means the body never mentioned them, which is what every client
    written before this feature sends, and leaves them alone. An empty list
    clears them.
    """
    from app.models import Amenity

    if not isinstance(payload, dict) or payload.get("amenity_ids") is None:
        return None, None

    raw = payload["amenity_ids"]
    if not isinstance(raw, list):
        return None, "amenity_ids must be a list of amenity ids."

    ids = []
    for value in raw:
        # bool is an int in Python, and `true` is not an amenity.
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            return None, "Each amenity must be chosen from the list."
        try:
            ids.append(int(value))
        except ValueError:
            return None, "Each amenity must be chosen from the list."

    ids = list(dict.fromkeys(ids))
    if not ids:
        return [], None

    found = Amenity.query.filter(Amenity.id.in_(ids)).all()
    if len(found) != len(ids):
        return None, "Each amenity must be chosen from the list."
    return found, None
