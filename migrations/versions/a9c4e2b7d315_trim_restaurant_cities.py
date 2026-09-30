"""trim the spaces around restaurant cities

A city was saved as typed, so "Houston " sat in the city filter beside
"Houston" and was never found by it (#128). The form trims what it saves
now; this trims what it saved before.

Only the spaces around a city go. Case is left as each owner wrote it: the
filter and the list of cities ignore it, and which spelling is right is
not a migration's to decide.

Revision ID: a9c4e2b7d315
Revises: e3a8c1f5d927
Create Date: 2026-10-01 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'a9c4e2b7d315'
down_revision = 'e3a8c1f5d927'
branch_labels = None
depends_on = None


def _table():
    schema = SCHEMA if environment == "production" else None
    return f"{schema}.restaurants" if schema else "restaurants"


def upgrade():
    op.get_bind().execute(sa.text(
        f"UPDATE {_table()} SET city = TRIM(city) WHERE city <> TRIM(city)"
    ))


def downgrade():
    # The spaces carried nothing, and which rows had them is not kept.
    pass
