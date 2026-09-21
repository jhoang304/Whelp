"""record the S3 key an upload minted, so deletes stop trusting urls

A url on an image row is whatever the caller typed. Every cleanup path turned
one back into an object key and deleted it, which made typing a stranger's url
authority to destroy their image. These columns hold the key this app minted
for the uploader; a delete acts on the key, and a row without one -- a
hot-linked image, someone else's upload, anything older than user-scoped keys
-- is never deleted from the bucket.

Existing rows are backfilled from their url where it names an object in our
bucket, since those genuinely are ours, but only where exactly one row across
the three tables names it. A key two rows share is left null on both: deleting
one would pull the object out from under the other, and orphaning an object is
the better failure.

The backfill needs S3_BUCKET set to recognise our own urls. Without it the
columns are simply left null, which costs nothing but some orphaned objects.

Revision ID: c1a75e0f4b20
Revises: b4d7f1a6e93c
Create Date: 2026-09-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

import os
environment = os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
SCHEMA = os.environ.get("SCHEMA")

# revision identifiers, used by Alembic.
revision = 'c1a75e0f4b20'
down_revision = 'b4d7f1a6e93c'
branch_labels = None
depends_on = None

# (table, url column, key column)
IMAGE_COLUMNS = [
    ('restaurant_images', 'url', 's3_key'),
    ('review_images', 'url', 's3_key'),
    ('users', 'profile_image_url', 'profile_image_key'),
]


def bucket_location():
    bucket = os.environ.get("S3_BUCKET")
    return f"https://{bucket}.s3.amazonaws.com/" if bucket else None


def qualified(table, schema):
    return f"{schema}.{table}" if schema else table


def keys_by_url(urls, location):
    """
    {url: key} for the urls this backfill should trust.

    Ours, and named by exactly one row. A url two rows share gets no key on
    either: deleting one would pull the object out from under the other, and
    an orphaned object is the better failure of the two.
    """
    counts = {}
    for url in urls:
        if url and url.startswith(location):
            counts[url] = counts.get(url, 0) + 1
    return {url: url[len(location):] for url, count in counts.items()
            if count == 1 and url[len(location):]}


def upgrade():
    schema = SCHEMA if environment == "production" else None

    for table, _, key_column in IMAGE_COLUMNS:
        op.add_column(table, sa.Column(key_column, sa.String(length=255), nullable=True),
                      schema=schema)

    location = bucket_location()
    if not location:
        return

    connection = op.get_bind()

    urls = []
    for table, url_column, _ in IMAGE_COLUMNS:
        rows = connection.execute(sa.text(
            f"SELECT {url_column} AS url FROM {qualified(table, schema)} "
            f"WHERE {url_column} IS NOT NULL"
        ))
        urls.extend(row.url for row in rows)

    for url, key in keys_by_url(urls, location).items():
        for table, url_column, key_column in IMAGE_COLUMNS:
            connection.execute(sa.text(
                f"UPDATE {qualified(table, schema)} SET {key_column} = :key "
                f"WHERE {url_column} = :url"
            ), {"key": key, "url": url})


def downgrade():
    schema = SCHEMA if environment == "production" else None
    for table, _, key_column in IMAGE_COLUMNS:
        # batch mode lets SQLite drop a column by rebuilding the table
        with op.batch_alter_table(table, schema=schema) as batch_op:
            batch_op.drop_column(key_column)
