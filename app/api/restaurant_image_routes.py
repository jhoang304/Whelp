from flask import Blueprint, jsonify, request, session
from flask_login import login_required, current_user
from app.models import RestaurantImage
from app.models import db
from app.api.aws_helpers import remove_file_from_s3
from app.api.utils import clear_other_previews

resImage_routes = Blueprint('restaurantImages', __name__)

# delete restauant image by image id
@resImage_routes.route('/<int:imageId>', methods=["DELETE"])
@login_required
def delete_res_image(imageId):
    """
    Delete a restaurant image. Allowed for the user who uploaded it or the
    owner of the restaurant. Files we uploaded to S3 are removed as well.
    """
    image = RestaurantImage.query.get(imageId)
    if not image:
        return {"errors": ["Image couldn't be found"]}, 404

    is_uploader = image.createdByUserId == current_user.id
    is_owner = image.restaurant is not None and image.restaurant.user_id == current_user.id
    if not (is_uploader or is_owner):
        return {"errors": ["Only the uploader or the business owner can delete this photo"]}, 403

    url = image.url
    db.session.delete(image)
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
    image = RestaurantImage.query.get(imageId)
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
