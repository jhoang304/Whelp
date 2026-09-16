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

# The column this migration replaces, and restores on downgrade, was int4.
INT_MAX = 2147483647


def _table():
    """Raw-SQL table name, schema-qualified in production."""
    return f"{SCHEMA}.restaurants" if environment == "production" else "restaurants"


def _fits_in_integer(dialect):
    """
    SQL boolean: this postcode is digits only and inside the old int4 range.

    Written as an ordered CASE rather than a chain of ANDs because neither
    engine promises to evaluate the arms of a boolean operator left to right,
    and the numeric comparison is only safe once the digit and length checks
    have passed.
    """
    if dialect == "postgresql":
        non_digit, to_number, yes, no = "zipcode !~ '^[0-9]+$'", "zipcode::bigint", "true", "false"
    else:
        non_digit, to_number, yes, no = "zipcode GLOB '*[^0-9]*'", "CAST(zipcode AS INTEGER)", "1", "0"
    return (
        f"(CASE WHEN {non_digit} THEN {no}"
        f" WHEN length(zipcode) > 10 THEN {no}"
        f" ELSE {to_number} <= {INT_MAX} END)"
    )


def _loses_information(dialect):
    """
    SQL boolean: converting this postcode back to an integer would not round
    trip. Either it is not a number the old column could hold at all, or it
    carries a leading zero that integer storage would silently drop.
    """
    return (f"(NOT {_fits_in_integer(dialect)}"
            f" OR (zipcode LIKE '0%' AND length(zipcode) > 1))")


# int4 goes down to -2147483648, which is 11 characters and does not fit the
# new column. Portable: both engines accept CAST(x AS TEXT).
TOO_LONG_FOR_COLUMN = "length(CAST(zipcode AS TEXT)) > 10"


def _pad_to_five():
    """
    Postgres expression casting the old integer to text, zero-padding values
    short of five digits back to five.

    Only all-digit values are padded. The old column was a bare IntegerField
    behind DataRequired, so a legacy negative zipcode is possible, and
    lpad('-123', 5, '0') would rewrite it as '0-123'. Those values are junk
    either way; this migration's job is not to make them worse, so anything
    that is not four-or-fewer digits passes through as-is.
    """
    return ("CASE WHEN zipcode::text ~ '^[0-9]{1,4}$'"
            " THEN lpad(zipcode::text, 5, '0')"
            " ELSE zipcode::text END")


def upgrade():
    schema = SCHEMA if environment == "production" else None
    table = _table()

    # Postgres would fail the ALTER here with an opaque "value too long for
    # type character varying(10)", and SQLite would quietly overfill the
    # column, so say plainly what is wrong before touching anything.
    too_long = op.get_bind().execute(sa.text(
        f"SELECT count(*) FROM {table} WHERE {TOO_LONG_FOR_COLUMN}"
    )).scalar()
    if too_long:
        raise RuntimeError("\n".join([
            f"{too_long} restaurant(s) have a zipcode of more than 10 characters, "
            "which will not fit the VARCHAR(10) this migration creates.",
            "Review them first:",
            f"    SELECT id, zipcode FROM {table} WHERE {TOO_LONG_FOR_COLUMN};",
        ]))

    if op.get_bind().dialect.name == "postgresql":
        # Cast and pad in one statement so the column is never invalid.
        op.alter_column(
            'restaurants', 'zipcode',
            existing_type=sa.Integer(),
            type_=sa.String(length=10),
            existing_nullable=False,
            postgresql_using=_pad_to_five(),
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
        # `NOT GLOB '*[^0-9]*'` keeps the padding off negative values, matching
        # the Postgres expression above.
        op.execute(
            f"UPDATE {table} SET zipcode = substr('00000' || zipcode, -5, 5) "
            "WHERE length(zipcode) < 5 AND zipcode NOT GLOB '*[^0-9]*'"
        )


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
    doomed = _loses_information(dialect)

    lossy = op.get_bind().execute(sa.text(
        f"SELECT count(*) FROM {table} WHERE {doomed}"
    )).scalar()

    if lossy and os.environ.get("ALLOW_LOSSY_DOWNGRADE") != "1":
        raise RuntimeError("\n".join([
            f"{lossy} restaurant(s) have a postcode that cannot be stored as an "
            f"integer (non-numeric, out of range, or a leading zero that would be lost).",
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
            postgresql_using=(
                f"(CASE WHEN {_fits_in_integer(dialect)}"
                " THEN zipcode::bigint ELSE 0 END)::integer"
            ),
            schema=schema,
        )
    else:
        # Zero only what genuinely will not fit; the table rebuild below turns
        # the rest into integers (dropping leading zeros) on its own.
        op.execute(f"UPDATE {table} SET zipcode = '0' WHERE NOT {_fits_in_integer(dialect)}")
        with op.batch_alter_table('restaurants', schema=schema) as batch_op:
            batch_op.alter_column(
                'zipcode',
                existing_type=sa.String(length=10),
                type_=sa.Integer(),
                existing_nullable=False,
            )
