"""
`flask check-db` answers one question a failing deploy cannot: which database
does this service actually have, and does it accept us?
"""
import pytest
from sqlalchemy.exc import OperationalError

import pathlib
import re

from app.cli import describe_database, fingerprint
from sqlalchemy.engine.url import make_url
from app.models import db


@pytest.fixture()
def run(app):
    return app.test_cli_runner()


def test_it_reports_the_connection_and_says_it_worked(run):
    result = run.invoke(args=["check-db"])
    assert result.exit_code == 0, result.output
    assert "check-db: connected" in result.output
    assert "environment=" in result.output
    assert "host=" in result.output
    assert "password length=" in result.output


def test_it_never_prints_the_password(app, run, monkeypatch):
    secret = "hunter2-hunter2"
    monkeypatch.setitem(app.config, "SQLALCHEMY_DATABASE_URI",
                        f"postgresql://someone:{secret}@db.example.com:5432/whelp")

    result = run.invoke(args=["check-db"])
    assert secret not in result.output
    assert f"password length={len(secret)}" in result.output
    assert f"fingerprint={fingerprint(secret)}" in result.output


def test_a_refused_connection_fails_the_command(app, run, monkeypatch):
    """
    It runs before `flask db upgrade` in the build, so it has to stop the
    build -- and say why in one line rather than forty frames.
    """
    monkeypatch.setattr(db.engine, "connect", refuse)

    result = run.invoke(args=["check-db"])
    assert result.exit_code == 1
    assert "check-db: refused -> OperationalError" in result.output
    assert "password authentication failed" in result.output


def test_the_fingerprint_distinguishes_secrets_without_revealing_them():
    """Two environments compare fingerprints to see if they hold the same value."""
    assert fingerprint("same") == fingerprint("same")
    assert fingerprint("same") != fingerprint("different")
    assert fingerprint("") == "none"
    assert len(fingerprint("anything")) == 8
    assert "anything" not in fingerprint("anything")


def refuse():
    """Answer the way Neon has been answering this deployment."""
    raise OperationalError(
        "SELECT 1", {},
        Exception("FATAL:  password authentication failed for user 'neondb_owner'"))


def test_the_description_is_shared_with_the_migration():
    """
    `flask db upgrade` prints these lines too, so a failed deploy says which
    database it tried even when nobody added check-db to the build command.
    """
    url = make_url("postgresql://neondb_owner:sixteen-chars-x@ep-x-pooler.neon.tech:5432/neondb?sslmode=require")
    lines = describe_database(url)

    assert any("user=neondb_owner" in line and "host=ep-x-pooler.neon.tech" in line for line in lines)
    assert any("password length=15" in line for line in lines)
    assert not any("sixteen-chars-x" in line for line in lines)


def test_the_migration_runner_executes_no_bare_strings():
    """
    SQLAlchemy 2.0 refuses a raw string, and the CREATE SCHEMA in env.py runs
    only when APP_ENV is production -- so the SQLite suite never reaches it and
    the first successful deploy would have been the one to find out.
    """
    source = (pathlib.Path(__file__).resolve().parents[1]
              / "migrations" / "env.py").read_text(encoding="utf-8")
    executes = [line.strip() for line in source.splitlines() if "connection.execute(" in line]

    assert executes, "expected the migration runner to execute something"
    for call in executes:
        assert "connection.execute(text(" in call, f"{call} needs text()"
