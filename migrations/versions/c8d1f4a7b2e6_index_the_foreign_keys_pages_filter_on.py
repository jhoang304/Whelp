"""index the foreign keys every page filters on

Postgres doesn't index a foreign key by itself, and these were read by on
every page and scanned in full each time (#137):

- reviews, by restaurant and by author, each newest first -- the two
  feeds. The index is the filter then the order, so a page comes straight
  off it instead of every matching review being sorted first. (By author
  was already findable through the one-review-per-person index, but not in
  order.)
- review_images, by review: every review's photos.
- restaurant_images, by restaurant: the partial one-cover index only
  serves "WHERE preview".
- restaurants, by owner: a profile's businesses.
- restaurant_categories, by category: its primary key leads with the
  restaurant, and the listing's cuisine filter asks by category.

Indexes only: no data changes, and the downgrade drops them again.

Revision ID: c8d1f4a7b2e6
Revises: f4c7a2e9b153
Create Date: 2026-10-03 10:00:00.000000

"""
from alembic import op

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")


# revision identifiers, used by Alembic.
revision = 'c8d1f4a7b2e6'
down_revision = 'f4c7a2e9b153'
branch_labels = None
depends_on = None

# (name, table, columns), named as the models name them.
INDEXES = [
    ("ix_reviews_restaurant_newest", "reviews", ["restaurant_id", "createdAt", "id"]),
    ("ix_reviews_user_newest", "reviews", ["user_id", "createdAt", "id"]),
    ("ix_review_images_review_id", "review_images", ["review_id"]),
    ("ix_restaurant_images_restaurant_id", "restaurant_images", ["restaurant_id"]),
    ("ix_restaurants_user_id", "restaurants", ["user_id"]),
    ("ix_restaurant_categories_category_id", "restaurant_categories", ["category_id"]),
]


def _schema():
    return SCHEMA if environment == "production" else None


def upgrade():
    for name, table, columns in INDEXES:
        op.create_index(name, table, columns, schema=_schema())


def downgrade():
    for name, table, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table, schema=_schema())
