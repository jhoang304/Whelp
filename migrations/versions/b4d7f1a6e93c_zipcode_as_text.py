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


def _unrepresentable_predicate(dialect):
    """
    SQL matching postcodes that cannot survive a trip back through an integer
    column: letters or punctuation (ZIP+4, Canadian, UK), a leading zero that
    integer storage would drop, or more digits than an int holds.
    """
    has_non_digit = "zipcode !~ '^[0-9]+$'" if dialect == "postgresql" else "zipcode GLOB '*[^0-9]*'"
    return f"({has_non_digit} OR zipcode LIKE '0%' OR length(zipcode) > 9)"


def downgrade():
    """
    An integer column cannot hold a ZIP+4, a Canadian or UK postcode, or the
    leading zero on 02134, so this refuses to run while any row still has one
    rather than destroying it quietly. Fix those values yourself first, or set
    ALLOW_LOSSY_DOWNGRADE=1 to accept that they become 0 or lose the zero.
    """
    schema = SCHEMA if environment == "production" else None
    dialect = op.get_bind().dialect.name
    table = _table()
    doomed = _unrepresentable_predicate(dialect)

    unrepresentable = op.get_bind().execute(sa.text(
        f"SELECT count(*) FROM {table} WHERE {doomed}"
    )).scalar()

    if unrepresentable and os.environ.get("ALLOW_LOSSY_DOWNGRADE") != "1":
        raise RuntimeError("\n".join([
            f"{unrepresentable} restaurant(s) have a postcode that cannot be stored as "
            f"an integer (non-numeric, or a leading zero that would be lost).",
            "Review them first:",
            f"    SELECT id, zipcode FROM {table} WHERE {doomed};",
            "or re-run with ALLOW_LOSSY_DOWNGRADE=1 to accept the loss.",
        ]))

    if dialect == "postgresql":
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
            f"UPDATE {table} SET zipcode = '0' "
            "WHERE zipcode GLOB '*[^0-9]*' OR length(zipcode) > 9"
        )
        with op.batch_alter_table('restaurants', schema=schema) as batch_op:
            batch_op.alter_column(
                'zipcode',
                existing_type=sa.String(length=10),
                type_=sa.Integer(),
                existing_nullable=False,
            )
