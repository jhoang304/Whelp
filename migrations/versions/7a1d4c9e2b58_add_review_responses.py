"""add business-owner review responses

Revision ID: 7a1d4c9e2b58
Revises: 3f9c2b7d1a4e
Create Date: 2026-09-11 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = '7a1d4c9e2b58'
down_revision = '3f9c2b7d1a4e'
branch_labels = None
depends_on = None


def _prefixed(table):
    """Foreign-key targets must be schema-qualified in production."""
    return f"{SCHEMA}.{table}" if environment == "production" else table


def upgrade():
    op.create_table('review_responses',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('review_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('response', sa.String(length=1000), nullable=False),
    sa.Column('createdAt', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updatedAt', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['review_id'], [f"{_prefixed('reviews')}.id"], ),
    sa.ForeignKeyConstraint(['user_id'], [f"{_prefixed('users')}.id"], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('review_id')
    )
    if environment == "production":
        op.execute(f"ALTER TABLE review_responses SET SCHEMA {SCHEMA};")


def downgrade():
    schema = SCHEMA if environment == "production" else None
    op.drop_table('review_responses', schema=schema)
