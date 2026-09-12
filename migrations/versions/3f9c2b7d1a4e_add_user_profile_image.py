"""add profile_image_url to users

Revision ID: 3f9c2b7d1a4e
Revises: cc6f8a983a1d
Create Date: 2026-09-11 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = '3f9c2b7d1a4e'
down_revision = 'cc6f8a983a1d'
branch_labels = None
depends_on = None


def upgrade():
    schema = SCHEMA if environment == "production" else None
    op.add_column(
        'users',
        sa.Column('profile_image_url', sa.String(length=255), nullable=True),
        schema=schema,
    )


def downgrade():
    schema = SCHEMA if environment == "production" else None
    # batch mode lets SQLite drop a column by rebuilding the table
    with op.batch_alter_table('users', schema=schema) as batch_op:
        batch_op.drop_column('profile_image_url')
