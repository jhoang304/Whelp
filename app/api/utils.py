def error_messages(form_errors):
    """Flatten WTForms' {field: [messages]} into a plain list of messages."""
    messages = []
    for field in form_errors:
        for error in form_errors[field]:
            messages.append(error)
    return messages


def clear_other_previews(restaurant_id, keep_image_id=None):
    """
    Drop `preview` from a restaurant's other images so at most one row is its
    cover photo. Call it inside the transaction that sets the new preview;
    it stages the changes and leaves the commit to the caller.

    The restaurant row is locked first. Without it, two cover changes racing
    on the same restaurant would both read the old cover, both demote it, and
    both commit a preview=True row, leaving the listing to pick whichever
    iterated last. Postgres blocks the second caller here until the first
    commits; SQLite ignores FOR UPDATE, which is fine for the test suite.
    """
    from app.models import Restaurant, RestaurantImage

    Restaurant.query.filter(Restaurant.id == restaurant_id).with_for_update().first()

    query = RestaurantImage.query.filter(
        RestaurantImage.restaurant_id == restaurant_id,
        RestaurantImage.preview == True,  # noqa: E712 - SQLAlchemy column comparison
    )
    if keep_image_id is not None:
        query = query.filter(RestaurantImage.id != keep_image_id)
    for image in query.all():
        image.preview = False
