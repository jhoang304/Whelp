"""
The configuration and auth defaults from #31: a secret that must exist, SQL
logging that stays off, a password floor, and a login route that cannot be
hammered.
"""
import importlib
import os
import re
import pathlib

import pytest

from app.config import Config
from app.environment import current_environment, is_production
from app.extensions import limiter
from app.forms.signup_form import PASSWORD_MIN_LENGTH


def test_booting_without_a_secret_key_fails_loudly(monkeypatch):
    """
    It used to boot fine and then fail on every request, at the point the CSRF
    cookie was generated, which says nothing about the cause.
    """
    monkeypatch.delenv("SECRET_KEY", raising=False)
    import app.config

    with pytest.raises(RuntimeError) as raised:
        importlib.reload(app.config)
    assert "SECRET_KEY" in str(raised.value)
    assert "secrets.token_hex" in str(raised.value), "say how to make one"

    # Leave the module as the rest of the session found it.
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
    importlib.reload(app.config)


def test_sql_echo_is_off_unless_asked_for():
    """It was on unconditionally, so production logged every statement."""
    assert Config.SQLALCHEMY_ECHO is False


def test_app_env_names_the_deployment(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    assert current_environment() == "production"
    assert is_production()

    monkeypatch.setenv("APP_ENV", "development")
    assert not is_production()


def test_flask_env_is_still_honoured(monkeypatch):
    """
    Flask 2.3 removed FLASK_ENV, but the deployed service still sets it. A
    deploy that has not had APP_ENV added yet must not quietly decide it is in
    development and address the wrong schema.
    """
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.setenv("FLASK_ENV", "production")
    assert is_production()

    monkeypatch.setenv("APP_ENV", "development")
    assert not is_production(), "APP_ENV wins when both are set"


def test_no_environment_set_is_development(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("FLASK_ENV", raising=False)
    assert current_environment() == "development"
    assert not is_production()


def test_the_app_does_not_answer_cross_origin(client):
    """
    CORS(app) allowed every origin. The React build is served from this same
    app, so nothing needed it.
    """
    res = client.get("/api/restaurants/", headers={"Origin": "https://example.com"})
    assert "Access-Control-Allow-Origin" not in res.headers


def signup_body(password):
    return {"username": "newcomer", "email": "newcomer@test.io",
            "first_name": "New", "last_name": "Comer", "password": password}


def test_a_short_password_is_refused(client):
    client.get("/api/auth/")
    res = client.post("/api/auth/signup", json=signup_body("a"))
    assert res.status_code == 400
    assert any(str(PASSWORD_MIN_LENGTH) in message for message in res.get_json()["errors"])


def test_a_long_enough_password_is_accepted(client):
    client.get("/api/auth/")
    res = client.post("/api/auth/signup", json=signup_body("x" * PASSWORD_MIN_LENGTH))
    assert res.status_code == 200, res.get_json()


def test_the_client_and_server_password_rules_are_the_same():
    """A client looser than the server sends a doomed request; stricter lies."""
    source = (pathlib.Path(__file__).resolve().parents[1] / "react-app" / "src"
              / "components" / "SignupFormPage" / "index.tsx").read_text(encoding="utf-8")
    declared = re.search(r"PASSWORD_MIN_LENGTH = (\d+);", source)
    assert declared, "the signup page should declare the minimum it checks"
    assert int(declared.group(1)) == PASSWORD_MIN_LENGTH


@pytest.fixture()
def rate_limited(app):
    """
    The suite runs with limits off -- it logs in dozens of times a second --
    so a test about the limit has to turn it back on, and reset the counters
    afterwards so the next test starts with a full allowance.
    """
    limiter.enabled = True
    limiter.reset()
    yield
    limiter.reset()
    limiter.enabled = False


def test_login_attempts_are_rate_limited(client, rate_limited):
    client.get("/api/auth/")
    attempt = lambda: client.post("/api/auth/login",
                                  json={"email": "owner@test.io", "password": "wrong"})

    statuses = [attempt().status_code for _ in range(11)]
    assert statuses.count(429) >= 1, statuses
    assert statuses[0] == 401, "the first attempts are answered normally"


def test_a_throttled_request_keeps_the_error_shape(client, rate_limited):
    client.get("/api/auth/")
    for _ in range(11):
        res = client.post("/api/auth/login",
                          json={"email": "owner@test.io", "password": "wrong"})
        if res.status_code == 429:
            break
    assert res.status_code == 429
    assert res.mimetype == "application/json"
    assert isinstance(res.get_json()["errors"], list) and res.get_json()["errors"]


def test_signup_is_rate_limited_too(client, rate_limited):
    client.get("/api/auth/")
    statuses = [client.post("/api/auth/signup", json=signup_body("password")).status_code
                for _ in range(11)]
    assert statuses.count(429) >= 1, statuses


def test_the_proxy_hop_count_follows_the_environment(monkeypatch):
    """
    Behind Render's proxy the client address is in X-Forwarded-For, so the
    limiter needs ProxyFix to see it -- and must not trust that header
    anywhere a proxy does not actually stand.
    """
    import app.config

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("TRUSTED_PROXY_HOPS", raising=False)
    assert importlib.reload(app.config).Config.TRUSTED_PROXY_HOPS == 1

    monkeypatch.setenv("APP_ENV", "development")
    assert importlib.reload(app.config).Config.TRUSTED_PROXY_HOPS == 0

    monkeypatch.setenv("TRUSTED_PROXY_HOPS", "2")
    assert importlib.reload(app.config).Config.TRUSTED_PROXY_HOPS == 2

    monkeypatch.delenv("TRUSTED_PROXY_HOPS")
    importlib.reload(app.config)


def test_a_forwarded_address_cannot_buy_a_fresh_allowance(client, rate_limited):
    """
    With no proxy in front, X-Forwarded-For is whatever the caller typed. If
    it keyed the limit, a script would change it each request and never be
    throttled at all.
    """
    client.get("/api/auth/")
    statuses = []
    for attempt in range(12):
        res = client.post("/api/auth/login",
                          json={"email": "owner@test.io", "password": "wrong"},
                          headers={"X-Forwarded-For": f"203.0.113.{attempt}"})
        statuses.append(res.status_code)
    assert 429 in statuses, statuses


def test_flaskenv_does_not_name_the_environment():
    """
    The flask CLI loads .flaskenv, and this file is committed -- so a value
    here reaches the deployed service whenever it runs `flask db upgrade` or
    `flask seed all`. APP_ENV=development in it beat the FLASK_ENV=production
    that Render sets, which would have migrated the default schema while the
    web process used the production one.
    """
    flaskenv = (pathlib.Path(__file__).resolve().parents[1] / ".flaskenv").read_text(encoding="utf-8")
    named = [line for line in flaskenv.splitlines()
             if line.strip().startswith(("APP_ENV", "FLASK_ENV"))]
    assert not named, f".flaskenv must leave the environment to the deployment: {named}"
