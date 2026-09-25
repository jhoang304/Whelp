"""reviews outlive their authors: reviews.user_id becomes nullable

Deleting an account keeps the reviews it wrote, anonymised as "Deleted user",
rather than taking them with it: they are part of other businesses' ratings,
and an owner's reply to one would otherwise be left replying to nothing. A
null author is how a review says its writer has gone.

Revision ID: c5f1e8a3b927
Revises: a9e4c7b2d813
Create Date: 2026-09-25 18:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'c5f1e8a3b927'
down_revision = 'a9e4c7b2d813'
branch_labels = None
depends_on = None


def _schema():
    return SCHEMA if environment == "production" else None


def _alter(nullable):
    schema = _schema()
    if op.get_bind().dialect.name == "postgresql":
        op.alter_column('reviews', 'user_id', existing_type=sa.Integer(),
                        nullable=nullable, schema=schema)
    else:
        # SQLite cannot alter a column in place; batch mode rebuilds the table.
        with op.batch_alter_table('reviews', schema=schema) as batch_op:
            batch_op.alter_column('user_id', existing_type=sa.Integer(), nullable=nullable)


def upgrade():
    _alter(nullable=True)


def downgrade():
    # Putting NOT NULL back would have to delete every anonymised review, and
    # a downgrade that quietly throws away other people's ratings is worse
    # than one that stops and says why.
    table = f"{SCHEMA}.reviews" if environment == "production" else "reviews"
    orphans = op.get_bind().execute(
        sa.text(f"SELECT COUNT(*) FROM {table} WHERE user_id IS NULL")).scalar()
    if orphans:
        raise RuntimeError(
            f"{orphans} review(s) belong to deleted accounts and have no author. "
            "Delete them, or give them one, before downgrading past c5f1e8a3b927.")
    _alter(nullable=False)
