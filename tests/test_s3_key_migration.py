"""
Which existing rows the s3_key backfill trusts.

The columns arrive empty and a row without a key is never deleted from the
bucket, so the only question this migration has to get right is which urls it
may turn back into deletable keys.
"""
import importlib.util
import pathlib

MIGRATION = (pathlib.Path(__file__).resolve().parents[1] / "migrations" / "versions"
             / "c1a75e0f4b20_add_s3_key_columns.py")

_spec = importlib.util.spec_from_file_location("s3_key_migration", MIGRATION)
s3_key_migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(s3_key_migration)

keys_by_url = s3_key_migration.keys_by_url

BUCKET = "https://whelp-test-bucket.s3.amazonaws.com/"


def test_our_own_urls_become_keys():
    assert keys_by_url([BUCKET + "abc123.png"], BUCKET) == {BUCKET + "abc123.png": "abc123.png"}


def test_user_scoped_keys_survive_the_path_intact():
    url = BUCKET + "uploads/7/abc123.png"
    assert keys_by_url([url], BUCKET) == {url: "uploads/7/abc123.png"}


def test_other_hosts_are_left_alone():
    """A hot-linked image is a link, not an object we may delete."""
    assert keys_by_url(["https://i.imgur.com/c7KuGow.png", "", None], BUCKET) == {}


def test_a_url_two_rows_share_gets_no_key():
    """
    Whoever deleted first would take the object out from under the other row.
    Orphaning it costs storage; deleting it costs someone their picture.
    """
    shared = BUCKET + "shared.png"
    assert keys_by_url([shared, shared, BUCKET + "alone.png"], BUCKET) == {
        BUCKET + "alone.png": "alone.png"
    }


def test_the_bare_bucket_url_is_not_a_key():
    assert keys_by_url([BUCKET], BUCKET) == {}
