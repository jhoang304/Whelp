"""categories and the restaurants they describe

The search page invites you to look for "Italian" or "Mexican" while nothing
in the schema records what a restaurant serves, so the invitation only works
when the owner happened to write the word in their description.

A join table rather than a column on restaurants: a place is Japanese *and* a
sushi bar, and one row per pairing is what lets a filter ask for rows instead
of matching text.

The taxonomy itself is not inserted here -- `flask seed all` ensures it, so a
category added later reaches an already-populated database without another
migration.

Revision ID: e7a3f92c5d18
Revises: d83b16c5e7a2
Create Date: 2026-09-21 15:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'e7a3f92c5d18'
down_revision = 'd83b16c5e7a2'
branch_labels = None
depends_on = None


def _schema():
    return SCHEMA if environment == "production" else None


def _qualified(table):
    schema = _schema()
    return f"{schema}.{table}" if schema else table


def upgrade():
    schema = _schema()

    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_categories_name'),
        sa.UniqueConstraint('slug', name='uq_categories_slug'),
        schema=schema,
    )

    # ON DELETE CASCADE as well as the ORM relationship: deleting a restaurant
    # must not leave a row pointing at nothing, whichever hand does the delete.
    op.create_table(
        'restaurant_categories',
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['restaurant_id'], [f"{_qualified('restaurants')}.id"],
                                name='fk_restaurant_categories_restaurant', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['category_id'], [f"{_qualified('categories')}.id"],
                                name='fk_restaurant_categories_category', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('restaurant_id', 'category_id'),
        schema=schema,
    )


def downgrade():
    schema = _schema()
    op.drop_table('restaurant_categories', schema=schema)
    op.drop_table('categories', schema=schema)
