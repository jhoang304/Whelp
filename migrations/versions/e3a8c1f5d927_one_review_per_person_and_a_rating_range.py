"""one review per person per restaurant, and a rating from 1 to 5

Both rules lived only in the routes, which check and then insert. Two
requests close together -- a double click, a retry, two tabs -- could each
pass the check and leave two reviews of one restaurant by one person,
counted twice in its average (#119). These constraints hold the rules in the
database, for the routes and for anything else that writes a row.

Reviews whose author has left have no user_id, and NULLs never clash, so any
number of "Deleted user" reviews of one restaurant can stand.

Rows written before this may already break a rule, and which duplicate to
keep -- or what a rating of 7 was meant to be -- is not a migration's
decision: if there are any, the upgrade stops and names them.

Revision ID: e3a8c1f5d927
Revises: b7e2d9c4a1f6
Create Date: 2026-09-29 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'e3a8c1f5d927'
down_revision = 'b7e2d9c4a1f6'
branch_labels = None
depends_on = None

UNIQUE_NAME = 'uq_reviews_user_restaurant'
CHECK_NAME = 'ck_reviews_rating_range'


def _schema():
    return SCHEMA if environment == "production" else None


def upgrade():
    schema = _schema()
    table = f"{schema}.reviews" if schema else "reviews"
    connection = op.get_bind()

    problems = []
    duplicates = connection.execute(sa.text(
        f"SELECT user_id, restaurant_id, COUNT(*) AS reviews FROM {table} "
        f"WHERE user_id IS NOT NULL GROUP BY user_id, restaurant_id HAVING COUNT(*) > 1 "
        f"ORDER BY user_id, restaurant_id"
    )).fetchall()
    if duplicates:
        listed = ", ".join(f"user {row.user_id} on restaurant {row.restaurant_id} ({row.reviews} reviews)"
                           for row in duplicates)
        problems.append(f"{len(duplicates)} person/restaurant pair(s) have more than one review: {listed}")
    out_of_range = connection.execute(sa.text(
        f"SELECT id, rating FROM {table} WHERE rating < 1 OR rating > 5 ORDER BY id"
    )).fetchall()
    if out_of_range:
        listed = ", ".join(f"review {row.id} (rating {row.rating})" for row in out_of_range)
        problems.append(f"{len(out_of_range)} review(s) have a rating outside 1 to 5: {listed}")
    if problems:
        raise RuntimeError(
            "; ".join(problems)
            + ". Keep one review for each pair and put every rating in range, then run the upgrade again."
        )

    # Batch mode, for SQLite: it cannot add a constraint to an existing
    # table, so batch rebuilds it. On Postgres these are plain ALTER TABLEs.
    with op.batch_alter_table('reviews', schema=schema) as batch_op:
        batch_op.create_unique_constraint(UNIQUE_NAME, ['user_id', 'restaurant_id'])
        batch_op.create_check_constraint(CHECK_NAME, 'rating BETWEEN 1 AND 5')


def downgrade():
    with op.batch_alter_table('reviews', schema=_schema()) as batch_op:
        batch_op.drop_constraint(CHECK_NAME, type_='check')
        batch_op.drop_constraint(UNIQUE_NAME, type_='unique')
