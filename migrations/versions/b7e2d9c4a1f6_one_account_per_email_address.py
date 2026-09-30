"""one account per email address, whatever its case

users.email was unique only as typed, so signing up as "Owner@test.io" beside
"owner@test.io" made a second account, and logging in with the other casing
failed (#117). The app now stores and looks up addresses in lower case; this
index holds the rule for anything else that writes a row.

Two accounts whose addresses differ only in case cannot both stay, and which
one to keep is not a migration's decision: if there are any, the upgrade
stops and names them. Otherwise the stored addresses are lower-cased, which
cannot collide once the index exists.

Revision ID: b7e2d9c4a1f6
Revises: c5f1e8a3b927
Create Date: 2026-09-29 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'b7e2d9c4a1f6'
down_revision = 'c5f1e8a3b927'
branch_labels = None
depends_on = None

INDEX_NAME = 'uq_users_email_lower'


def _schema():
    return SCHEMA if environment == "production" else None


def upgrade():
    schema = _schema()
    table = f"{schema}.users" if schema else "users"
    connection = op.get_bind()

    duplicates = connection.execute(sa.text(
        f"SELECT lower(email) AS address, COUNT(*) AS accounts FROM {table} "
        f"GROUP BY lower(email) HAVING COUNT(*) > 1 ORDER BY lower(email)"
    )).fetchall()
    if duplicates:
        listed = ", ".join(f"{row.address} ({row.accounts} accounts)" for row in duplicates)
        raise RuntimeError(
            f"{len(duplicates)} email address(es) belong to more than one account once case is "
            f"ignored: {listed}. Keep one account for each, by deleting or changing the email of "
            f"the others, then run the upgrade again."
        )

    op.create_index(INDEX_NAME, 'users', [sa.text('lower(email)')], unique=True, schema=schema)
    connection.execute(sa.text(f"UPDATE {table} SET email = lower(email) WHERE email <> lower(email)"))


def downgrade():
    # The lower-cased addresses stay lower-cased: the casing they were typed
    # in is gone, and it was never meaningful.
    op.drop_index(INDEX_NAME, table_name='users', schema=_schema())
