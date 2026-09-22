from flask import Blueprint

from app.models import Category

category_routes = Blueprint('categories', __name__)


@category_routes.route('/')
def categories():
    """
    The whole taxonomy, by name.

    Not paginated: it is a closed list a filter bar and a create form both
    render in full, and a page of it would be a page of nothing.
    """
    rows = Category.query.order_by(Category.name).all()
    return {"items": [category.to_dict() for category in rows]}
