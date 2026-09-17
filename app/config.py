import os

from app.environment import current_environment, is_production


def _flag(name, default=False):
    """Read a boolean-ish environment variable."""
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        # Booting without one used to work: every request then failed at the
        # point the CSRF cookie was generated, which is a long way from the
        # cause. Say it here instead.
        raise RuntimeError(
            "SECRET_KEY is not set. Generate one with\n"
            '    python -c "import secrets; print(secrets.token_hex(32))"\n'
            "and put it in your .env (see .env.example)."
        )

    ENV = current_environment()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # SQLAlchemy 1.4 no longer supports url strings that start with 'postgres'
    # (only 'postgresql') but heroku's postgres add-on automatically sets the
    # url in the hidden config vars to start with postgres.
    # so the connection uri must be updated here (for production)
    SQLALCHEMY_DATABASE_URI = (os.environ.get('DATABASE_URL') or 'sqlite:///dev.db').replace('postgres://', 'postgresql://')

    # Guessing passwords should be slow. The limits themselves are on the
    # login and signup routes. The default store is per process, so a service
    # running several workers gives each of them its own allowance: point
    # RATELIMIT_STORAGE_URI at Redis to make the limit mean one thing.
    RATELIMIT_ENABLED = _flag("RATELIMIT_ENABLED", default=True)
    RATELIMIT_STORAGE_URI = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")

    # Echoing every statement is a debugging tool. It used to be on
    # unconditionally, which meant production logged the whole query storm of
    # every page load. Opt in with SQLALCHEMY_ECHO=1, and never in production.
    SQLALCHEMY_ECHO = _flag("SQLALCHEMY_ECHO") and not is_production()
