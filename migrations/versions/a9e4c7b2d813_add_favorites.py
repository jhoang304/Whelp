"""favorites: restaurants a user has saved

A row per save, unique per person and restaurant, so saving twice is still
one bookmark. Both foreign keys cascade: a deleted restaurant leaves nobody's
list, and a deleted account takes its list with it.

Revision ID: a9e4c7b2d813
Revises: f2b8c4d9e071
Create Date: 2026-09-25 06:10:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'a9e4c7b2d813'
down_revision = 'f2b8c4d9e071'
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
        'favorites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('createdAt', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'),
                  nullable=False),
        sa.ForeignKeyConstraint(['user_id'], [f"{_qualified('users')}.id"],
                                name='fk_favorites_user', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['restaurant_id'], [f"{_qualified('restaurants')}.id"],
                                name='fk_favorites_restaurant', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'restaurant_id', name='uq_favorites_user_restaurant'),
        schema=schema,
    )
    op.create_index('ix_favorites_user_id', 'favorites', ['user_id'], schema=schema)
    op.create_index('ix_favorites_restaurant_id', 'favorites', ['restaurant_id'], schema=schema)


def downgrade():
    schema = _schema()
    op.drop_index('ix_favorites_restaurant_id', table_name='favorites', schema=schema)
    op.drop_index('ix_favorites_user_id', table_name='favorites', schema=schema)
    op.drop_table('favorites', schema=schema)
