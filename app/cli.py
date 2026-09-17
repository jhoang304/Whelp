"""
Commands for looking at a deployment's own configuration.

Kept separate from the routes: these run from the build, before the app ever
serves a request.
"""
import hashlib
import os

import click
from flask import current_app
from flask.cli import with_appcontext
from sqlalchemy import text
from sqlalchemy.engine.url import make_url

from app.environment import current_environment


def fingerprint(secret):
    """
    Eight hex characters of a secret's digest.

    Enough to say whether two environments hold the same value, without
    printing the value: run the same command in both and compare.
    """
    if not secret:
        return "none"
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()[:8]


def describe_database(url):
    """
    What a deployment can say about its database without saying the password:
    who it connects as, where, and a fingerprint to compare with another
    environment that believes it holds the same credential.
    """
    password = url.password or ""
    return [
        f"environment={current_environment()} schema={os.environ.get('SCHEMA')}",
        f"user={url.username} host={url.host} port={url.port} "
        f"database={url.database} query={dict(url.query)}",
        f"password length={len(password)} fingerprint={fingerprint(password)}",
    ]


@click.command("check-db")
@with_appcontext
def check_db():
    """Report which database this deployment will use, and whether it answers."""
    from app.models import db

    for line in describe_database(make_url(current_app.config["SQLALCHEMY_DATABASE_URI"])):
        click.echo(f"check-db: {line}")

    try:
        with db.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as error:
        # The driver's message is the useful half; the traceback above it is
        # forty frames of SQLAlchemy.
        click.echo(f"check-db: refused -> {type(error).__name__}: {error}")
        raise SystemExit(1)

    click.echo("check-db: connected")
