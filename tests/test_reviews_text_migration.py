"""
The migration that turns reviews.review into TEXT (#133), run for real
against SQLite, where batch mode rebuilds the whole table to change one
column: the reviews, the one-review-per-person rule and the rating range
have to come through it, and the way back has to refuse to cut anyone's
review short unless told to.
"""
import importlib.util
import pathlib

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

MIGRATION = (pathlib.Path(__file__).resolve().parents[1] / "migrations" / "versions"
             / "f4c7a2e9b153_reviews_as_text.py")

_spec = importlib.util.spec_from_file_location("reviews_text_migration", MIGRATION)
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)

LONG = "A meal worth more than two sentences. " * 20  # 760 characters


@pytest.fixture()
def engine():
    """The reviews table as the migration before this one left it."""
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(sa.text("""
            CREATE TABLE reviews (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                restaurant_id INTEGER NOT NULL,
                review VARCHAR(255) NOT NULL,
                rating INTEGER NOT NULL,
                CONSTRAINT uq_reviews_user_restaurant UNIQUE (user_id, restaurant_id),
                CONSTRAINT ck_reviews_rating_range CHECK (rating BETWEEN 1 AND 5)
            )
        """))
        connection.execute(sa.text(
            "INSERT INTO reviews (id, user_id, restaurant_id, review, rating) VALUES (1, 1, 1, 'Solid.', 4)"))
    yield engine
    engine.dispose()


def run(engine, step):
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            step()


def review_type(engine):
    column = next(c for c in sa.inspect(engine).get_columns("reviews") if c["name"] == "review")
    return column["type"]


def reviews(engine):
    with engine.connect() as connection:
        return connection.execute(sa.text("SELECT id, review FROM reviews ORDER BY id")).fetchall()


def insert(engine, review_id, user_id, review, rating=5):
    with engine.begin() as connection:
        connection.execute(sa.text(
            "INSERT INTO reviews (id, user_id, restaurant_id, review, rating) VALUES (:id, :user, 1, :review, :rating)"),
            {"id": review_id, "user": user_id, "review": review, "rating": rating})


def test_upgrade_makes_the_column_text_and_keeps_every_review(engine):
    run(engine, migration.upgrade)

    assert isinstance(review_type(engine), sa.Text)
    assert getattr(review_type(engine), "length", None) is None
    assert reviews(engine) == [(1, "Solid.")]


def test_the_rules_on_reviews_come_through_the_rebuilt_table(engine):
    run(engine, migration.upgrade)

    with pytest.raises(sa.exc.IntegrityError):
        insert(engine, 2, 1, "A second review of the same place.")
    with pytest.raises(sa.exc.IntegrityError):
        insert(engine, 3, 2, "Six stars.", rating=6)


def test_downgrade_goes_back_when_every_review_fits(engine):
    run(engine, migration.upgrade)
    run(engine, migration.downgrade)

    assert isinstance(review_type(engine), sa.String)
    assert review_type(engine).length == 255
    assert reviews(engine) == [(1, "Solid.")]


def test_downgrade_refuses_to_cut_a_long_review_short(engine, monkeypatch):
    monkeypatch.delenv("ALLOW_LOSSY_DOWNGRADE", raising=False)
    run(engine, migration.upgrade)
    insert(engine, 2, 2, LONG)

    with pytest.raises(RuntimeError, match="1 review\\(s\\) are longer than 255 characters"):
        run(engine, migration.downgrade)

    assert isinstance(review_type(engine), sa.Text)
    assert reviews(engine)[1] == (2, LONG)


def test_downgrade_cuts_long_reviews_when_told_to(engine, monkeypatch):
    monkeypatch.setenv("ALLOW_LOSSY_DOWNGRADE", "1")
    run(engine, migration.upgrade)
    insert(engine, 2, 2, LONG)

    run(engine, migration.downgrade)

    assert review_type(engine).length == 255
    assert reviews(engine) == [(1, "Solid."), (2, LONG[:255])]
