"""
Truth table for the zipcode migration's SQL predicates, evaluated by SQLite
itself rather than by eye.

`_fits_in_integer` decides what the downgrade writes; `_loses_information`
decides whether it refuses to run at all. They have to disagree in exactly
one place -- a value that converts cleanly but drops a leading zero -- so
they are worth pinning.
"""
import importlib.util
import pathlib
import sqlite3

import pytest

MIGRATION = (pathlib.Path(__file__).resolve().parents[1]
             / "migrations" / "versions" / "b4d7f1a6e93c_zipcode_as_text.py")

_spec = importlib.util.spec_from_file_location("zipcode_migration", MIGRATION)
zipcode_migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(zipcode_migration)


@pytest.fixture()
def evaluate():
    """Run a migration predicate against one postcode, in real SQLite."""
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE restaurants (zipcode VARCHAR(10))")

    def run(predicate, zipcode):
        connection.execute("DELETE FROM restaurants")
        connection.execute("INSERT INTO restaurants VALUES (?)", (zipcode,))
        return bool(connection.execute(
            f"SELECT {predicate} FROM restaurants").fetchone()[0])

    yield run
    connection.close()


# zipcode, fits in the old int4 column, would lose information on the way back
CASES = [
    ("77003",      True,  False),  # ordinary five digit ZIP
    ("0",          True,  False),  # degenerate, but it does round trip
    ("770031234",  True,  False),  # nine digits: the old column held these
    ("1000000000", True,  False),  # ten digits, still inside int4
    ("2147483647", True,  False),  # exactly int4 max
    ("02134",      True,  True),   # converts, but the leading zero is dropped
    ("2147483648", False, True),   # one past int4 max
    ("9999999999", False, True),   # ten digits, far out of range
    ("M5V 3L9",    False, True),   # Canadian
    ("SW1A 1AA",   False, True),   # UK
    ("77003-1234", False, True),   # ZIP+4
]


@pytest.mark.parametrize("zipcode, fits, _lossy", CASES)
def test_fits_in_integer(evaluate, zipcode, fits, _lossy):
    assert evaluate(zipcode_migration._fits_in_integer("sqlite"), zipcode) is fits


@pytest.mark.parametrize("zipcode, _fits, lossy", CASES)
def test_loses_information(evaluate, zipcode, _fits, lossy):
    assert evaluate(zipcode_migration._loses_information("sqlite"), zipcode) is lossy


def test_postgres_padding_is_restricted_to_short_digit_strings():
    """
    lpad() both truncates anything wider than its target and happily pads a
    negative number into nonsense, so it must only ever see one to four
    digits: 770031234 must not become 77003, and -123 must not become 0-123.
    """
    expression = zipcode_migration._pad_to_five()
    assert "lpad(" in expression
    assert "^[0-9]{1,4}$" in expression
    assert expression.endswith("ELSE zipcode::text END")


def test_postgres_downgrade_bounds_by_range_not_digit_count():
    """A ten digit value inside int4 must not be discarded as 'too long'."""
    fits = zipcode_migration._fits_in_integer("postgresql")
    assert str(zipcode_migration.INT_MAX) in fits
    assert "{1,9}" not in MIGRATION.read_text(encoding="utf-8")


# --- upgrade-side padding ---------------------------------------------------

@pytest.fixture()
def pad():
    """Apply the SQLite upgrade's padding rule to one legacy integer value."""
    connection = sqlite3.connect(":memory:")
    connection.execute("CREATE TABLE restaurants (zipcode)")

    def run(value):
        connection.execute("DELETE FROM restaurants")
        connection.execute("INSERT INTO restaurants VALUES (?)", (value,))
        connection.execute(
            "UPDATE restaurants SET zipcode = substr('00000' || zipcode, -5, 5) "
            "WHERE length(zipcode) < 5 AND zipcode NOT GLOB '*[^0-9]*'")
        return connection.execute("SELECT zipcode FROM restaurants").fetchone()[0]

    yield run
    connection.close()


@pytest.mark.parametrize("before, after", [
    (2134, "02134"),        # the case the migration exists for
    (77003, 77003),         # already five digits, untouched
    (770031234, 770031234), # longer than five, untouched
    (-123, -123),           # lpad/substr would have made this '0-123'
])
def test_padding_leaves_non_digit_values_alone(pad, before, after):
    assert pad(before) == after


def test_over_long_values_are_caught_before_the_column_shrinks(evaluate):
    """int4 reaches -2147483648: 11 characters, too wide for VARCHAR(10)."""
    predicate = zipcode_migration.TOO_LONG_FOR_COLUMN
    assert evaluate(predicate, "-2147483648") is True
    assert evaluate(predicate, "2147483647") is False
    assert evaluate(predicate, "02134") is False
