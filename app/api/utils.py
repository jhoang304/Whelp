def error_messages(form_errors):
    """Flatten WTForms' {field: [messages]} into a plain list of messages."""
    messages = []
    for field in form_errors:
        for error in form_errors[field]:
            messages.append(error)
    return messages


def lock_restaurant(restaurant_id):
    """
    Take a row lock on the restaurant so its photo changes serialise.

    Every route that adds, promotes or removes one of a restaurant's images
    must call this *before* reading the rows it is going to act on, and hold it
    until commit. Locking only the cover-changing paths is not enough: deleting
    the cover promotes the oldest remaining photo, and a plain delete of that
    photo — which changes no cover itself — is exactly what must not interleave.

    Postgres blocks the second caller here until the first commits. SQLite
    ignores FOR UPDATE, which is fine for the single-connection test suite.
    """
    from app.models import Restaurant

    Restaurant.query.filter(Restaurant.id == restaurant_id).with_for_update().first()


def clear_other_previews(restaurant_id, keep_image_id=None):
    """
    Drop `preview` from a restaurant's other images so at most one row is its
    cover photo. Call it inside the transaction that sets the new preview;
    it stages the changes and leaves the commit to the caller.

    Takes the restaurant lock: without it, two cover changes racing on the same
    restaurant would both read the old cover, both demote it, and both commit a
    preview=True row, leaving the listing to pick whichever iterated last.
    Re-taking a lock the caller already holds is free within one transaction.
    """
    from app.models import RestaurantImage

    lock_restaurant(restaurant_id)

    query = RestaurantImage.query.filter(
        RestaurantImage.restaurant_id == restaurant_id,
        RestaurantImage.preview == True,  # noqa: E712 - SQLAlchemy column comparison
    )
    if keep_image_id is not None:
        query = query.filter(RestaurantImage.id != keep_image_id)
    for image in query.all():
        image.preview = False
