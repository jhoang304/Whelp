"""
The url alembic reconnects with has to carry the password.

`flask db upgrade` does not reuse the app's engine: env.py hands alembic a url
string, and alembic parses it back into a connection. Anything lost in that
round trip is lost from every migration the deployment runs.
"""
import pathlib

from sqlalchemy.engine.url import make_url

PASSWORD = "sixteencharacter"
URL = make_url(f"postgresql://neondb_owner:{PASSWORD}@ep-x-pooler.neon.tech/neondb?sslmode=require")

ENV_PY = pathlib.Path(__file__).resolve().parents[1] / "migrations" / "env.py"


def round_trip(rendered):
    """What alembic does with the string env.py gives it."""
    return make_url(rendered.replace("%%", "%")).password


def test_the_rendering_env_py_uses_keeps_the_password():
    rendered = URL.render_as_string(hide_password=False).replace("%", "%%")
    assert round_trip(rendered) == PASSWORD


def test_str_of_a_url_would_lose_it():
    """
    Why the line above is written the long way. SQLAlchemy 1.4 rendered the
    password here; 2.0 masks it, so the upgrade turned every deployed
    migration into a login as neondb_owner with the password '***'.
    """
    assert round_trip(str(URL)) == "***"


def test_env_py_does_not_stringify_the_engine_url():
    source = ENV_PY.read_text(encoding="utf-8")
    assert "render_as_string(hide_password=False)" in source
    assert "str(current_app.extensions['migrate'].db.engine.url)" not in source


def test_env_py_still_escapes_for_the_ini_parser():
    """A % in a password is interpolation to the ini file alembic reads."""
    source = ENV_PY.read_text(encoding="utf-8")
    assert ".replace('%', '%%')" in source
