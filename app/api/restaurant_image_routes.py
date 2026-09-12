from flask import Blueprint, jsonify, request, session
from flask_login import login_required, current_user
from app.models import RestaurantImage
from app.models import db
from app.api.aws_helpers import remove_file_from_s3

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


#get a list of restaurant images by restaurant id
@resImage_routes.route("/<int:restaurantId>/images")
# @login_required
def get_res_images_by_res_id(restaurantId):
    res_images=RestaurantImage.query.filter(RestaurantImage.restaurant_id == restaurantId).all()


    return [image.to_dict() for image in res_images]
