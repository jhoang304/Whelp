from flask import Blueprint, request
from flask_login import login_required, current_user
from app.models import RestaurantImage
from app.models import db
from app.api.aws_helpers import remove_file_from_s3
from app.api.utils import clear_other_previews, lock_restaurant

resImage_routes = Blueprint('restaurantImages', __name__)

# delete restauant image by image id
@resImage_routes.route('/<int:imageId>', methods=["DELETE"])
@login_required
def delete_res_image(imageId):
    """
    Delete a restaurant image. Allowed for the user who uploaded it or the
    owner of the restaurant. Files we uploaded to S3 are removed as well.
    """
    image = db.session.get(RestaurantImage, imageId)
    if not image:
        return {"errors": ["Image couldn't be found"]}, 404

    is_uploader = image.createdByUserId == current_user.id
    is_owner = image.restaurant is not None and image.restaurant.user_id == current_user.id
    if not (is_uploader or is_owner):
        return {"errors": ["Only the uploader or the business owner can delete this photo"]}, 403

    restaurant_id = image.restaurant_id

    # Lock before reading anything this transaction acts on. Deleting the cover
    # promotes another photo, so it has to be serialised against every other
    # delete for this restaurant — including ones that change no cover
    # themselves, since those can remove the very row we are about to promote.
    lock_restaurant(restaurant_id)

    # Re-read under the lock: the row may have changed, or gone, while we
    # waited for it. populate_existing() overwrites the copy already in the
    # session rather than handing back the stale one.
    image = (RestaurantImage.query
             .populate_existing()
             .filter(RestaurantImage.id == imageId)
             .first())
    if not image:
        return {"errors": ["Image couldn't be found"]}, 404

    url = image.url
    was_cover = bool(image.preview)

    db.session.delete(image)
    db.session.flush()

    if was_cover:
        # Deleting the cover used to leave the restaurant with no preview=True
        # row at all, so the listing fell back to the placeholder until someone
        # noticed and set a new one. Promote the oldest remaining photo; the
        # lock above is what makes it still be there at commit.
        replacement = (RestaurantImage.query
                       .filter(RestaurantImage.restaurant_id == restaurant_id)
                       .order_by(RestaurantImage.id)
                       .first())
        if replacement:
            clear_other_previews(restaurant_id, keep_image_id=replacement.id)
            replacement.preview = True

    db.session.commit()
    remove_file_from_s3(url)
    return {"message": "Successfully deleted"}


# make a restaurant image the cover photo
@resImage_routes.route('/<int:imageId>/cover', methods=["PUT"])
@login_required
def set_res_image_as_cover(imageId):
    """
    Mark one of a restaurant's photos as its cover. Owner only, and the
    restaurant's other photos lose `preview` in the same transaction so
    exactly one row can ever be the cover.
    """
    image = db.session.get(RestaurantImage, imageId)
    if not image:
        return {"errors": ["Image couldn't be found"]}, 404

    if image.restaurant is None or image.restaurant.user_id != current_user.id:
        return {"errors": ["Only the business owner can set the cover photo"]}, 403

    clear_other_previews(image.restaurant_id, keep_image_id=image.id)
    image.preview = True
    db.session.commit()
    return image.to_dict()


#get a list of restaurant images by restaurant id
@resImage_routes.route("/<int:restaurantId>/images")
# @login_required
def get_res_images_by_res_id(restaurantId):
    res_images=RestaurantImage.query.filter(RestaurantImage.restaurant_id == restaurantId).all()


    return [image.to_dict() for image in res_images]
