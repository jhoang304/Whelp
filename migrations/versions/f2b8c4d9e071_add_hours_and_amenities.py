"""opening hours, amenities, and the timezone they are read in

Every restaurant claimed to be open until 9:30PM and to offer the same four
things, because the card and the detail page had those words typed into them.

Hours are a row per day a restaurant opens: a day with no row is a day it is
closed, and `closes` at or before `opens` means the night runs past midnight,
so a bar open 17:00-02:00 is one row rather than two.

The timezone is on the restaurant because "open now" is a question about the
clock on its own wall. The demo restaurants alone span Houston, Los Angeles,
New York and Las Vegas; answering from the server's clock, or the reader's,
is wrong in three of those four. It is nullable, and nothing guesses: a
restaurant that has not said gets no open/closed line at all.

Revision ID: f2b8c4d9e071
Revises: e7a3f92c5d18
Create Date: 2026-09-22 00:20:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'f2b8c4d9e071'
down_revision = 'e7a3f92c5d18'
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
        'amenities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', name='uq_amenities_name'),
        sa.UniqueConstraint('slug', name='uq_amenities_slug'),
        schema=schema,
    )

    op.create_table(
        'restaurant_amenities',
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('amenity_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['restaurant_id'], [f"{_qualified('restaurants')}.id"],
                                name='fk_restaurant_amenities_restaurant', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['amenity_id'], [f"{_qualified('amenities')}.id"],
                                name='fk_restaurant_amenities_amenity', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('restaurant_id', 'amenity_id'),
        schema=schema,
    )

    op.create_table(
        'restaurant_hours',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('weekday', sa.Integer(), nullable=False),
        sa.Column('opens', sa.Time(), nullable=False),
        sa.Column('closes', sa.Time(), nullable=False),
        sa.ForeignKeyConstraint(['restaurant_id'], [f"{_qualified('restaurants')}.id"],
                                name='fk_restaurant_hours_restaurant', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('restaurant_id', 'weekday', name='uq_restaurant_hours_day'),
        sa.CheckConstraint('weekday >= 0 AND weekday <= 6', name='ck_restaurant_hours_weekday'),
        schema=schema,
    )

    op.add_column('restaurants', sa.Column('timezone', sa.String(length=64), nullable=True),
                  schema=schema)


def downgrade():
    schema = _schema()
    op.drop_column('restaurants', 'timezone', schema=schema)
    op.drop_table('restaurant_hours', schema=schema)
    op.drop_table('restaurant_amenities', schema=schema)
    op.drop_table('amenities', schema=schema)
