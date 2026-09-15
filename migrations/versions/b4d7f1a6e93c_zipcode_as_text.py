"""store restaurants.zipcode as text

An integer column loses the leading zero on Boston-style ZIPs (02134 became
2134) and cannot hold ZIP+4, Canadian, or UK postcodes at all. Existing
values are cast to text and zero-padded back to five digits.

Revision ID: b4d7f1a6e93c
Revises: 9b3e5d2f7c14
Create Date: 2026-09-15 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")


# revision identifiers, used by Alembic.
revision = 'b4d7f1a6e93c'
down_revision = '9b3e5d2f7c14'
branch_labels = None
depends_on = None


def _table():
    """Raw-SQL table name, schema-qualified in production."""
    return f"{SCHEMA}.restaurants" if environment == "production" else "restaurants"


def upgrade():
    schema = SCHEMA if environment == "production" else None

    if op.get_bind().dialect.name == "postgresql":
        # Cast and zero-pad in one statement so the column is never invalid.
        op.alter_column(
            'restaurants', 'zipcode',
            existing_type=sa.Integer(),
            type_=sa.String(length=10),
            existing_nullable=False,
            postgresql_using="lpad(zipcode::text, 5, '0')",
            schema=schema,
        )
    else:
        # batch mode lets SQLite change a column type by rebuilding the table
        with op.batch_alter_table('restaurants', schema=schema) as batch_op:
            batch_op.alter_column(
                'zipcode',
                existing_type=sa.Integer(),
                type_=sa.String(length=10),
                existing_nullable=False,
            )
        op.execute(
            f"UPDATE {_table()} SET zipcode = substr('00000' || zipcode, -5, 5) "
            "WHERE length(zipcode) < 5"
        )


def downgrade():
    """
    Lossy: any postcode that isn't a plain run of digits (ZIP+4, Canadian,
    UK) cannot be represented as an integer and becomes 0.
    """
    schema = SCHEMA if environment == "production" else None

    if op.get_bind().dialect.name == "postgresql":
        op.alter_column(
            'restaurants', 'zipcode',
            existing_type=sa.String(length=10),
            type_=sa.Integer(),
            existing_nullable=False,
            postgresql_using="(CASE WHEN zipcode ~ '^[0-9]{1,9}$' THEN zipcode ELSE '0' END)::integer",
            schema=schema,
        )
    else:
        op.execute(
            f"UPDATE {_table()} SET zipcode = '0' "
            "WHERE zipcode GLOB '*[^0-9]*' OR length(zipcode) > 9"
        )
        with op.batch_alter_table('restaurants', schema=schema) as batch_op:
            batch_op.alter_column(
                'zipcode',
                existing_type=sa.String(length=10),
                type_=sa.Integer(),
                existing_nullable=False,
            )
