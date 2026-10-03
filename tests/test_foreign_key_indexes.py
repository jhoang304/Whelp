"""
The indexes #137 added live in two places: the migration that builds them in
production, and the models this suite's database is created from. If the two
drift, the tests stop measuring what production runs -- so they are checked
against each other.
"""
import importlib.util
import pathlib

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from app.models import db

MIGRATION = (pathlib.Path(__file__).resolve().parents[1] / "migrations" / "versions"
             / "c8d1f4a7b2e6_index_the_foreign_keys_pages_filter_on.py")

_spec = importlib.util.spec_from_file_location("fk_index_migration", MIGRATION)
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)


def model_indexes():
    """{index name: (table, [columns])} as the models declare them."""
    return {
        index.name: (table.name, [column.name for column in index.columns])
        for table in db.metadata.tables.values()
        for index in table.indexes
    }


def test_every_index_the_migration_builds_is_declared_on_its_model(app):
    declared = model_indexes()
    for name, table, columns in migration.INDEXES:
        assert declared.get(name) == (table, columns), name


def test_every_index_on_a_model_is_built_by_some_migration(app):
    """The other way round: a model index no migration builds exists in the tests and nowhere else."""
    migrations = "\n".join(path.read_text(encoding="utf-8") for path in MIGRATION.parent.glob("*.py"))
    unbuilt = [name for name in model_indexes() if f'"{name}"' not in migrations and f"'{name}'" not in migrations]
    assert unbuilt == []


def test_the_migration_builds_them_and_takes_them_away(app):
    """Run for real against SQLite: up builds all six, down drops all six."""
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        for statement in (
            'CREATE TABLE restaurants (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL)',
            'CREATE TABLE reviews (id INTEGER PRIMARY KEY, user_id INTEGER, restaurant_id INTEGER NOT NULL, '
            '"createdAt" DATETIME)',
            'CREATE TABLE review_images (id INTEGER PRIMARY KEY, review_id INTEGER NOT NULL)',
            'CREATE TABLE restaurant_images (id INTEGER PRIMARY KEY, restaurant_id INTEGER NOT NULL)',
            'CREATE TABLE restaurant_categories (restaurant_id INTEGER, category_id INTEGER, '
            'PRIMARY KEY (restaurant_id, category_id))',
        ):
            connection.execute(sa.text(statement))

    def run(step):
        with engine.begin() as connection:
            with Operations.context(MigrationContext.configure(connection)):
                step()

    def built():
        inspector = sa.inspect(engine)
        return {index["name"]: (table, index["column_names"])
                for table in inspector.get_table_names() for index in inspector.get_indexes(table)}

    run(migration.upgrade)
    assert built() == {name: (table, columns) for name, table, columns in migration.INDEXES}

    run(migration.downgrade)
    assert built() == {}
