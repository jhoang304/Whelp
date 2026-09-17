"""
Which deployment this is, in one place.

Flask 2.3 removed FLASK_ENV, so the name the app switches on is APP_ENV.
FLASK_ENV is still read as a fallback: the Render service sets it today, and a
deploy that has not had the new variable added yet must not silently decide it
is in development and address the wrong database schema.

That fallback only works while nothing sets APP_ENV to a wrong answer, which
is why .flaskenv must not name it: the flask CLI loads that file, so
`flask db upgrade` on the deployed service would have read development out of
the repository and migrated the wrong schema, while gunicorn -- which does not
load it -- served the right one.
"""
import os

PRODUCTION = "production"


def current_environment():
    """The deployment name: APP_ENV, then FLASK_ENV, then development."""
    return os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or "development"


def is_production():
    return current_environment() == PRODUCTION
