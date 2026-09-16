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

OLD_LENGTH = 20
NEW_LENGTH = 56


def _table():
    """Raw-SQL table name, schema-qualified in production."""
    return f"{SCHEMA}.restaurants" if environment == "production" else "restaurants"


def upgrade():
    schema = SCHEMA if environment == "production" else None
    # batch mode lets SQLite alter a column by rebuilding the table
    with op.batch_alter_table('restaurants', schema=schema) as batch_op:
        batch_op.alter_column(
            'country',
            existing_type=sa.String(length=OLD_LENGTH),
            type_=sa.String(length=NEW_LENGTH),
            existing_nullable=False,
        )


def downgrade():
    """
    A 20-character column cannot hold the country names the wider one made
    possible, so this refuses to run while any row still has one rather than
    truncating it out from under you. Shorten those values yourself first, or
    set ALLOW_LOSSY_DOWNGRADE=1 to say the truncation is what you want.
    """
    schema = SCHEMA if environment == "production" else None
    table = _table()

    oversized = op.get_bind().execute(sa.text(
        f"SELECT count(*) FROM {table} WHERE length(country) > {OLD_LENGTH}"
    )).scalar()

    if oversized:
        if os.environ.get("ALLOW_LOSSY_DOWNGRADE") != "1":
            raise RuntimeError("\n".join([
                f"{oversized} restaurant(s) have a country longer than {OLD_LENGTH} "
                f"characters and will not fit once this column is narrowed.",
                "Shorten them first:",
                f"    SELECT id, country FROM {table} WHERE length(country) > {OLD_LENGTH};",
                f"or re-run with ALLOW_LOSSY_DOWNGRADE=1 to truncate them to "
                f"{OLD_LENGTH} characters.",
            ]))
        op.execute(
            f"UPDATE {table} SET country = substr(country, 1, {OLD_LENGTH}) "
            f"WHERE length(country) > {OLD_LENGTH}"
        )

    with op.batch_alter_table('restaurants', schema=schema) as batch_op:
        batch_op.alter_column(
            'country',
            existing_type=sa.String(length=NEW_LENGTH),
            type_=sa.String(length=OLD_LENGTH),
            existing_nullable=False,
        )
