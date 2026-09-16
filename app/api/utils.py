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
    """
    from app.models import RestaurantImage

    query = RestaurantImage.query.filter(
        RestaurantImage.restaurant_id == restaurant_id,
        RestaurantImage.preview == True,  # noqa: E712 - SQLAlchemy column comparison
    )
    if keep_image_id is not None:
        query = query.filter(RestaurantImage.id != keep_image_id)
    for image in query.all():
        image.preview = False
