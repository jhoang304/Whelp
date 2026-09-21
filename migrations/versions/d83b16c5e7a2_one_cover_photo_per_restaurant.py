"""at most one cover photo per restaurant

"Exactly one preview=True row per restaurant" was enforced only by the code
that went through clear_other_previews, so anything else writing preview --
a seeder, a shell, a future route, or two requests racing -- could leave two.
The listing then shows whichever row iterates last, and a restaurant's cover
changes between requests for no visible reason.

Rows written before this may already break the rule, so the duplicates are
demoted first: the lowest id keeps the cover, which is the row #54's delete
path promotes to anyway.

Revision ID: d83b16c5e7a2
Revises: c1a75e0f4b20
Create Date: 2026-09-21 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'd83b16c5e7a2'
down_revision = 'c1a75e0f4b20'
branch_labels = None
depends_on = None

INDEX_NAME = 'uq_restaurant_images_one_preview'


def upgrade():
    schema = SCHEMA if environment == "production" else None
    table = f"{schema}.restaurant_images" if schema else "restaurant_images"

    # Demote every cover but the first for each restaurant, or the index below
    # cannot be created at all.
    op.get_bind().execute(sa.text(
        f"UPDATE {table} SET preview = false "
        f"WHERE preview AND id NOT IN ("
        f"    SELECT MIN(id) FROM {table} WHERE preview GROUP BY restaurant_id"
        f")"
    ))

    op.create_index(
        INDEX_NAME,
        'restaurant_images',
        ['restaurant_id'],
        unique=True,
        schema=schema,
        postgresql_where=sa.text('preview'),
        sqlite_where=sa.text('preview'),
    )


def downgrade():
    schema = SCHEMA if environment == "production" else None
    # The demoted rows stay demoted: they were never meant to be covers.
    op.drop_index(INDEX_NAME, table_name='restaurant_images', schema=schema)
