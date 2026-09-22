from flask import Blueprint

from app.models import Amenity

amenity_routes = Blueprint('amenities', __name__)


@amenity_routes.route('/')
def amenities():
    """
    Everything a restaurant can offer, by name.

    Not paginated: a closed list an edit form renders in full.
    """
    rows = Amenity.query.order_by(Amenity.name).all()
    return {"items": [amenity.to_dict() for amenity in rows]}
