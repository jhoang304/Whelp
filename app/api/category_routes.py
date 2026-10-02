from flask import Blueprint
from sqlalchemy import func

from app.api.utils import read_limit
from app.models import Category, db, restaurant_categories

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


@category_routes.route('/popular')
def popular_categories():
    """
    The cuisines restaurants are actually listed under, the most used first,
    each with how many restaurants it has: the home page's "Browse by
    cuisine" (#134). One nobody serves yet is nothing to browse, so it is
    left out; equal counts go by name.

    `limit` is how many: 12 unless asked, and at most 50.
    """
    limit, error = read_limit(default=12, most=50)
    if error:
        return {"errors": [error]}, 400

    restaurants = func.count(restaurant_categories.c.restaurant_id)
    rows = db.session.query(Category, restaurants).join(
        restaurant_categories, restaurant_categories.c.category_id == Category.id
    ).group_by(Category.id, Category.name, Category.slug).order_by(
        restaurants.desc(), Category.name
    ).limit(limit).all()
    return {"items": [{**category.to_dict(), "restaurantCount": count} for category, count in rows]}
