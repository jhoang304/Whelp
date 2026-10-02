"""reviews.review from VARCHAR(255) to TEXT

A review could be 255 characters, about two sentences: the original
String(255) column, never revisited, while the owner's reply to it may run
to 1,000 (#133). The column becomes TEXT and the limit moves to the form,
which takes 5,000. Every existing review fits, so the upgrade changes no
data.

Revision ID: f4c7a2e9b153
Revises: a9c4e2b7d315
Create Date: 2026-10-02 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")


# revision identifiers, used by Alembic.
revision = 'f4c7a2e9b153'
down_revision = 'a9c4e2b7d315'
branch_labels = None
depends_on = None

OLD_LENGTH = 255


def _schema():
    return SCHEMA if environment == "production" else None


def _table():
    """Raw-SQL table name, schema-qualified in production."""
    schema = _schema()
    return f"{schema}.reviews" if schema else "reviews"


def upgrade():
    # Batch mode, for SQLite, which rebuilds the table to change a column;
    # on Postgres it is a plain ALTER COLUMN ... TYPE TEXT.
    with op.batch_alter_table('reviews', schema=_schema()) as batch_op:
        batch_op.alter_column(
            'review',
            existing_type=sa.String(length=OLD_LENGTH),
            type_=sa.Text(),
            existing_nullable=False,
        )


def downgrade():
    """
    Going back can only cut reviews down to 255 characters, so this refuses
    to run while any review is longer, rather than truncate what people
    wrote out from under them. Shorten those reviews first, or set
    ALLOW_LOSSY_DOWNGRADE=1 to say the truncation is what you want.
    """
    table = _table()
    connection = op.get_bind()

    oversized = connection.execute(sa.text(
        f"SELECT count(*) FROM {table} WHERE length(review) > {OLD_LENGTH}"
    )).scalar()

    if oversized:
        if os.environ.get("ALLOW_LOSSY_DOWNGRADE") != "1":
            raise RuntimeError("\n".join([
                f"{oversized} review(s) are longer than {OLD_LENGTH} characters and "
                f"will not fit once this column is narrowed.",
                "Shorten them first:",
                f"    SELECT id, length(review) FROM {table} WHERE length(review) > {OLD_LENGTH};",
                f"or re-run with ALLOW_LOSSY_DOWNGRADE=1 to cut them to {OLD_LENGTH} characters.",
            ]))
        connection.execute(sa.text(
            f"UPDATE {table} SET review = substr(review, 1, {OLD_LENGTH}) "
            f"WHERE length(review) > {OLD_LENGTH}"
        ))

    with op.batch_alter_table('reviews', schema=_schema()) as batch_op:
        batch_op.alter_column(
            'review',
            existing_type=sa.Text(),
            type_=sa.String(length=OLD_LENGTH),
            existing_nullable=False,
        )
