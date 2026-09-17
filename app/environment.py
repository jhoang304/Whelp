"""
Which deployment this is, in one place.

Flask 2.3 removed FLASK_ENV, so the name the app switches on is APP_ENV.
FLASK_ENV is still read as a fallback: the Render service sets it today, and a
deploy that has not had the new variable added yet must not silently decide it
is in development and address the wrong database schema.
"""
import os

PRODUCTION = "production"


def current_environment():
    """The deployment name: APP_ENV, then FLASK_ENV, then development."""
    return os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development"


def is_production():
    return current_environment() == PRODUCTION
