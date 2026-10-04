"""sign in with Google

An account can now be made with, and signed in to with, a Google account:

- users.google_sub: the Google account's id -- the ID token's "sub", which
  stays the same when that account's address changes. Unique, and null for
  an account Google isn't connected to.
- users.hashed_password may be null: an account made with Google has no
  password until its owner sets one.

The downgrade gives each passwordless account a hash no password matches
before making the column required again. Those accounts can't be signed in
to until Google sign-in comes back.

Revision ID: d2a7f4c9e815
Revises: c8d1f4a7b2e6
Create Date: 2026-10-04 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")


# revision identifiers, used by Alembic.
revision = 'd2a7f4c9e815'
down_revision = 'c8d1f4a7b2e6'
branch_labels = None
depends_on = None

INDEX_NAME = 'uq_users_google_sub'
# Not a hash werkzeug can read, so check_password_hash says no to every
# password rather than raising.
UNUSABLE_HASH = '!'


def _schema():
    return SCHEMA if environment == "production" else None


def _keep_the_email_index():
    """
    SQLite can't make a column nullable in place, so batch mode rebuilds the
    users table there, from a reflection that may leave out an index on an
    expression -- #117's one account per lower(email). Put it back if so.
    Postgres alters the column in place and keeps it.
    """
    if op.get_bind().dialect.name == "sqlite":
        op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email))")


def upgrade():
    with op.batch_alter_table('users', schema=_schema()) as batch_op:
        batch_op.add_column(sa.Column('google_sub', sa.String(length=255), nullable=True))
        batch_op.alter_column('hashed_password', existing_type=sa.String(length=255), nullable=True)
        batch_op.create_index(INDEX_NAME, ['google_sub'], unique=True)
    _keep_the_email_index()


def downgrade():
    schema = _schema()
    table = f"{schema}.users" if schema else "users"
    op.execute(sa.text(f"UPDATE {table} SET hashed_password = :unusable WHERE hashed_password IS NULL")
               .bindparams(unusable=UNUSABLE_HASH))
    with op.batch_alter_table('users', schema=schema) as batch_op:
        batch_op.drop_index(INDEX_NAME)
        batch_op.alter_column('hashed_password', existing_type=sa.String(length=255), nullable=False)
        batch_op.drop_column('google_sub')
    _keep_the_email_index()
