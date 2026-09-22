import click
from flask.cli import AppGroup
from .users import seed_users, undo_users
from .restaurants import seed_restaurants, undo_restaurants
from .categories import ensure_categories, seed_restaurant_categories, undo_categories
from .restaurant_images import seed_restaurantImages, undo_restaurantImages
from .reviews import seed_reviews, undo_reviews
from .review_images import seed_reviewImages, undo_reviewImages
from .review_responses import seed_reviewResponses, undo_reviewResponses

from app.models import User
from app.models.db import db, environment, SCHEMA

# Creates a seed group to hold our commands
# So we can type `flask seed --help`
seed_commands = AppGroup('seed')


def _undo_all():
    # Children first so foreign keys are satisfied in every environment.
    undo_reviewResponses()
    undo_reviewImages()
    undo_reviews()
    undo_restaurantImages()
    undo_categories()
    undo_restaurants()
    undo_users()


def _seed_all():
    seed_users()
    seed_restaurants()
    seed_restaurant_categories()
    seed_restaurantImages()
    seed_reviews()
    seed_reviewImages()
    seed_reviewResponses()
    # Add other seed functions here


def _has_data():
    return db.session.query(User.id).first() is not None


# Creates the `flask seed all` command
@seed_commands.command('all')
@click.option('--reset', is_flag=True, default=False,
              help='Wipe every table first, then seed. Destroys existing data.')
def seed(reset):
    """
    Seed an empty database.

    Safe to keep in a deploy/build command: when the database already has
    data it does nothing, so redeploying never erases users' reviews and
    photos. Pass --reset to wipe everything and reseed on purpose.
    """
    if reset:
        _undo_all()

    # Before the skip below, not after it: the category list is reference data
    # a restaurant picks from, so a cuisine added to it has to reach the
    # databases that already have restaurants in them -- which is all of them.
    added = ensure_categories()
    if added:
        click.echo(f"Added {added} categor{'y' if added == 1 else 'ies'} to the taxonomy.")

    if not reset and _has_data():
        click.echo("Database already contains data; skipping seed. "
                   "Run `flask seed all --reset` to wipe it and reseed.")
        return
    _seed_all()
    click.echo("Seeded the database.")


# Creates the `flask seed undo` command
@seed_commands.command('undo')
def undo():
    """Remove every seeded (and user-created) row from all tables."""
    _undo_all()
    click.echo("Removed all data.")
