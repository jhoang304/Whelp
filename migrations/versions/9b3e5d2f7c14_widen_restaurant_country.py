"""widen restaurants.country to 56 characters

The RestaurantForm validator has always allowed 56 characters — the length of
the longest official country name — but the column only held 20, so anything
longer raised StringDataRightTruncation on Postgres and surfaced as a 500.
The column is the one that was wrong, so it grows to match.

Revision ID: 9b3e5d2f7c14
Revises: 7a1d4c9e2b58
Create Date: 2026-09-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")


# revision identifiers, used by Alembic.
revision = '9b3e5d2f7c14'
down_revision = '7a1d4c9e2b58'
branch_labels = None
depends_on = None


def upgrade():
    schema = SCHEMA if environment == "production" else None
    # batch mode lets SQLite alter a column by rebuilding the table
    with op.batch_alter_table('restaurants', schema=schema) as batch_op:
        batch_op.alter_column(
            'country',
            existing_type=sa.String(length=20),
            type_=sa.String(length=56),
            existing_nullable=False,
        )


def downgrade():
    schema = SCHEMA if environment == "production" else None
    # Truncate anything that no longer fits before shrinking the column back.
    table = f"{SCHEMA}.restaurants" if environment == "production" else "restaurants"
    op.execute(f"UPDATE {table} SET country = substr(country, 1, 20)")
    with op.batch_alter_table('restaurants', schema=schema) as batch_op:
        batch_op.alter_column(
            'country',
            existing_type=sa.String(length=56),
            type_=sa.String(length=20),
            existing_nullable=False,
        )
