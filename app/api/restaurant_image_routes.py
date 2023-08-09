from flask import Blueprint, jsonify, request, session
from flask_login import login_required, current_user
from app.models import RestaurantImage
from app.models import db

resImage_routes = Blueprint('restaurantImages', __name__)

# delete restauant image by image id
@resImage_routes.route('/<int:imageId>', methods=["DELETE"])
@login_required
def delete_res_image(imageId):
    """
    Query for a restaurant image by id and delete that image
    """

    deleted_res_image = RestaurantImage.query.get(imageId)
    db.session.delete(deleted_res_image)
    db.session.commit()
    return {"message": "Successfully deleted"}


#get a list of restaurant images by restaurant id
@resImage_routes.route("/<int:restaurantId>/images")
# @login_required
def get_res_images_by_res_id(restaurantId):
    res_images=RestaurantImage.query.filter(RestaurantImage.restaurant_id == restaurantId).all()


    return [image.to_dict() for image in res_images]
