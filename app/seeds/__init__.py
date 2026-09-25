import click
from flask.cli import AppGroup
from .users import seed_users, undo_users
from .restaurants import seed_restaurants, undo_restaurants
from .categories import ensure_categories, seed_restaurant_categories, undo_categories
from .amenities import ensure_amenities, seed_restaurant_amenities, undo_amenities
from .hours import seed_restaurant_hours, undo_hours
from .backfill import backfill as backfill_demo_details
from .restaurant_images import seed_restaurantImages, undo_restaurantImages
from .reviews import seed_reviews, undo_reviews
from .review_images import seed_reviewImages, undo_reviewImages
from .review_responses import seed_reviewResponses, undo_reviewResponses
from .favorites import undo_favorites

from app.models import User
from app.models.db import db, environment, SCHEMA

# Creates a seed group to hold our commands
# So we can type `flask seed --help`
seed_commands = AppGroup('seed')


def _undo_all():
    # Children first so foreign keys are satisfied in every environment.
    undo_favorites()
    undo_reviewResponses()
    undo_reviewImages()
    undo_reviews()
    undo_restaurantImages()
    undo_hours()
    undo_amenities()
    undo_categories()
    undo_restaurants()
    undo_users()


def _seed_all():
    seed_users()
    seed_restaurants()
    seed_restaurant_categories()
    seed_restaurant_amenities()
    seed_restaurant_hours()
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

    added = ensure_amenities()
    if added:
        click.echo(f"Added {added} amenit{'y' if added == 1 else 'ies'} to the list.")

    if not reset and _has_data():
        click.echo("Database already contains data; skipping seed. "
                   "Run `flask seed all --reset` to wipe it and reseed.")
        return
    _seed_all()
    click.echo("Seeded the database.")


# Creates the `flask seed backfill` command
@seed_commands.command('backfill')
@click.option('--apply', is_flag=True, default=False,
              help='Write the changes. Without it, only report what would change.')
def backfill(apply):
    """
    Give the demo restaurants the cuisines, amenities and hours a populated
    database never got, without touching anything an owner has set.

    Reports what it would do unless --apply is passed. Run it once, by hand:
    it is not a build step, because it cannot tell a restaurant with no hours
    from one whose owner cleared them.
    """
    changes, not_found, ambiguous = backfill_demo_details(apply=apply)

    if changes:
        verb = "Gave" if apply else "Would give"
        click.echo(f"{verb} {len(changes)} restaurant{'' if len(changes) == 1 else 's'} "
                   "what they were missing:")
        for name, gets in changes:
            click.echo(f"  {name}: {'; '.join(gets)}")
    else:
        click.echo("Nothing to fill in: every demo restaurant already has its details.")

    if not_found:
        click.echo(f"Not in this database, so left alone: {', '.join(not_found)}")
    if ambiguous:
        click.echo(f"More than one restaurant by this name, so left alone: {', '.join(ambiguous)}")

    if changes and not apply:
        click.echo("Nothing was written. Run again with --apply to write it.")


# Creates the `flask seed undo` command
@seed_commands.command('undo')
def undo():
    """Remove every seeded (and user-created) row from all tables."""
    _undo_all()
    click.echo("Removed all data.")
