"""
Signing in with Google: the flow, the accounts it makes and connects, and
what a passwordless account confirms with instead of a password.

Google itself is faked at the one place the app calls it,
google.request_tokens -- and the fake does what Google does with what it's
sent: checks the PKCE verifier against the challenge and the redirect URI
against the one the sign-in started with, then answers with an ID token
carrying the sign-in's nonce.
"""
import base64
import importlib.util
import io
import json
import pathlib
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

import app.api.auth_routes as auth_routes
from app.api import google, google_routes
from app.models import User, db
from app.models.user import DEMO_EMAIL
from tests.conftest import login

CLIENT_ID = "whelp-test.apps.googleusercontent.com"
CALLBACK = "http://localhost/api/auth/google/callback"


def id_token(claims):
    def part(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b"=").decode()
    return f"{part({'alg': 'RS256', 'typ': 'JWT'})}.{part(claims)}.not-checked"


class FakeGoogle:
    def __init__(self):
        self.asked = None  # the query string of the last trip to Google's page
        self.requests = []
        self.person = {}

    def claims(self):
        return {
            "iss": "https://accounts.google.com",
            "aud": CLIENT_ID,
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
            "nonce": self.asked["nonce"],
            "sub": "google-1001",
            "email": "jane.doe@gmail.com",
            "email_verified": True,
            "name": "Jane Doe",
            "given_name": "Jane",
            "family_name": "Doe",
            "picture": "https://lh3.googleusercontent.com/a/jane",
            **self.person,
        }

    def request_tokens(self, fields):
        self.requests.append(fields)
        if google.challenge(fields["code_verifier"]) != self.asked["code_challenge"]:
            raise google.GoogleError("invalid_grant: the verifier doesn't match")
        if fields["redirect_uri"] != self.asked["redirect_uri"]:
            raise google.GoogleError("redirect_uri_mismatch")
        return {"access_token": "unused", "token_type": "Bearer", "id_token": id_token(self.claims())}

    def go(self, response):
        """Follow a redirect to Google's page, and note what it was asked."""
        location = response.headers["Location"]
        assert location.startswith(google.AUTHORIZE_URL + "?"), location
        self.asked = {key: values[0] for key, values in parse_qs(urlsplit(location).query).items()}
        return self.asked

    def come_back(self, client, **query):
        query = {"code": "the-code", "state": self.asked["state"], **query}
        return client.get("/api/auth/google/callback", query_string=query)

    def sign_in(self, client, next_path="/single/1", **person):
        self.person = person
        self.go(client.get("/api/auth/google/start", query_string={"next": next_path}))
        return self.come_back(client)


@pytest.fixture()
def fake(app, monkeypatch):
    monkeypatch.setitem(app.config, "GOOGLE_CLIENT_ID", CLIENT_ID)
    monkeypatch.setitem(app.config, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    fake = FakeGoogle()
    monkeypatch.setattr(google, "request_tokens", fake.request_tokens)
    return fake


def signed_in(client):
    return client.get("/api/auth/").get_json()


def told(response):
    """Where a redirect went: "/login?google=cancelled"."""
    assert response.status_code == 302, response.status_code
    return response.headers["Location"]


def backdate_confirmation(client, seconds):
    with client.session_transaction() as session:
        mark = dict(session["google_confirmed"])
        mark["at"] -= seconds
        session["google_confirmed"] = mark


# --- whether it's offered -------------------------------------------------------------

def test_nothing_is_offered_without_a_client(client):
    assert client.get("/api/auth/google").get_json() == {"available": False, "confirmed": False}
    assert told(client.get("/api/auth/google/start")) == "/login?google=unavailable"


def test_it_is_offered_with_one(client, fake):
    assert client.get("/api/auth/google").get_json() == {"available": True, "confirmed": False}


# --- the trip to Google ------------------------------------------------------------------

def test_the_trip_to_google_asks_for_who_they_are_with_one_time_values(client, fake):
    asked = fake.go(client.get("/api/auth/google/start"))
    assert asked["client_id"] == CLIENT_ID
    assert asked["redirect_uri"] == CALLBACK
    assert asked["response_type"] == "code"
    assert asked["scope"] == "openid email profile"
    assert asked["code_challenge_method"] == "S256"
    assert asked["prompt"] == "select_account"
    with client.session_transaction() as session:
        flow = session["google_flow"]
    assert asked["state"] == flow["state"] and asked["nonce"] == flow["nonce"]
    assert asked["code_challenge"] == google.challenge(flow["verifier"])
    assert flow["verifier"] not in client.get("/api/auth/google/start").headers["Location"], \
        "the verifier stays here; only its challenge goes to Google"

    again = fake.go(client.get("/api/auth/google/start"))
    assert again["state"] != asked["state"] and again["nonce"] != asked["nonce"]


def test_the_challenge_is_pkce_s256():
    # RFC 7636, appendix B.
    assert google.challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") == \
        "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"


def test_someone_signed_in_already_goes_straight_back(client, fake):
    login(client, "owner@test.io")
    assert told(client.get("/api/auth/google/start?next=/single/1")) == "/single/1"


@pytest.mark.parametrize("next_path", [
    "//evil.example/", "/\\evil.example", "https://evil.example/", "evil", "/login", "/signup?x=1",
])
def test_it_only_comes_back_inside_the_app(client, fake, next_path):
    assert told(fake.sign_in(client, next_path=next_path)) == "/"


# --- signing in, and the account it makes ---------------------------------------------------

def test_a_first_sign_in_makes_an_account_and_comes_back(client, fake):
    assert told(fake.sign_in(client, next_path="/single/1?tab=photos")) == "/single/1?tab=photos"
    me = signed_in(client)
    assert me["username"] == "jane.doe"
    assert me["email"] == "jane.doe@gmail.com"
    assert (me["first_name"], me["last_name"]) == ("Jane", "Doe")
    assert me["profile_image_url"] == "https://lh3.googleusercontent.com/a/jane"
    assert me["hasPassword"] is False and me["googleConnected"] is True
    user = User.query.filter_by(email="jane.doe@gmail.com").one()
    assert user.google_sub == "google-1001" and user.hashed_password is None

    sent = fake.requests[0]
    assert sent["grant_type"] == "authorization_code" and sent["code"] == "the-code"
    assert sent["client_secret"] == "test-client-secret"


def test_signing_in_again_opens_the_same_account(client, fake):
    fake.sign_in(client)
    first = signed_in(client)["id"]
    client.get("/api/auth/logout")
    # Their Google address changed meanwhile: the account is found by Google's id.
    fake.sign_in(client, email="jane@newname.com")
    assert signed_in(client)["id"] == first
    assert User.query.count() == 4


def test_an_address_with_a_whelp_account_is_not_opened_by_google(client, fake, ids):
    """
    Whelp never checked that whoever signed up with the address owns it, so
    Google's say-so doesn't hand the account over: they log in with the
    password and connect Google from settings.
    """
    response = fake.sign_in(client, email="OWNER@test.io")
    assert told(response) == "/login?google=account-exists"
    assert signed_in(client) == {"user": None}
    assert db.session.get(User, ids["owner"]).google_sub is None
    assert User.query.count() == 3


def test_an_unverified_address_makes_no_account(client, fake):
    assert told(fake.sign_in(client, email_verified=False)) == "/login?google=unverified"
    assert signed_in(client) == {"user": None}
    assert User.query.count() == 3


def test_older_tokens_say_verified_as_a_string(client, fake):
    fake.sign_in(client, email_verified="true")
    assert signed_in(client)["username"] == "jane.doe"


def test_a_name_already_taken_gets_a_number(client, fake):
    db.session.add(User(username="Jane.Doe", email="other@test.io", password="password",
                        first_name="Other", last_name="Jane"))
    db.session.commit()
    fake.sign_in(client)
    assert signed_in(client)["username"] == "jane.doe2"


def test_names_are_made_to_fit(client, fake):
    fake.sign_in(client, email=("j+a.n!e" + "x" * 60) + "@Example.COM", given_name="G" * 80,
                 family_name=None, picture="https://lh3.googleusercontent.com/" + "p" * 300)
    me = signed_in(client)
    assert me["username"] == ("ja.ne" + "x" * 60)[:40]
    assert me["email"] == ("j+a.n!e" + "x" * 60).lower() + "@example.com"
    assert me["first_name"] == "G" * 50
    assert me["last_name"] == "", "not everyone gives Google a family name"
    assert me["profile_image_url"] is None, "too long for the column"


def test_with_no_given_name_the_whole_name_will_do(client, fake):
    fake.sign_in(client, given_name=None, family_name=None, name="Cher")
    assert signed_in(client)["first_name"] == "Cher"


def test_a_name_taken_between_the_check_and_the_commit_is_tried_again(client, fake, monkeypatch):
    names = iter(["owner", "jane.doe"])
    monkeypatch.setattr(google_routes, "_free_username", lambda email: next(names))
    fake.sign_in(client)
    assert signed_in(client)["username"] == "jane.doe"


def test_an_account_made_with_google_has_no_password_to_log_in_with(client, fake, monkeypatch):
    fake.sign_in(client)
    client.get("/api/auth/logout")

    checks = []
    real = auth_routes.check_password_hash
    monkeypatch.setattr(auth_routes, "check_password_hash", lambda *args: checks.append(1) or real(*args))
    for password in ("", "password", "!"):
        response = client.post("/api/auth/login", json={"email": "jane.doe@gmail.com", "password": password})
        assert response.status_code == 401
        assert response.get_json() == {"errors": ["Invalid credentials"]}
    # One hash check each, like an unknown address: the time taken says nothing.
    assert len(checks) == 2, "the empty password is refused by the form first"


def test_the_password_users_say_how_they_get_in(client):
    me = login(client, "owner@test.io")
    assert me["hasPassword"] is True and me["googleConnected"] is False


# --- what can go wrong on the way back --------------------------------------------------------

def test_a_callback_nobody_started_trades_nothing(client, fake):
    assert told(client.get("/api/auth/google/callback?code=x&state=y")) == "/login?google=expired"
    assert fake.requests == []


def test_another_sign_ins_state_trades_nothing(client, fake):
    fake.go(client.get("/api/auth/google/start"))
    assert told(fake.come_back(client, state="forged")) == "/login?google=expired"
    assert fake.requests == []
    assert signed_in(client) == {"user": None}


def test_a_code_is_good_for_one_try(client, fake):
    """Sent back a second time -- a reload, or a replay -- it is traded for nothing."""
    fake.sign_in(client)
    assert told(fake.come_back(client)) == "/login?google=expired"
    assert len(fake.requests) == 1


def test_one_whelp_account_per_google_account(app):
    """The database holds the rule too, under the checks the routes make first."""
    db.session.add_all([
        User(username="one", email="one@test.io", first_name="O", last_name="", google_sub="g-1"),
        User(username="two", email="two@test.io", first_name="T", last_name="", google_sub="g-1"),
    ])
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_cancelling_at_google_says_so(client, fake):
    fake.go(client.get("/api/auth/google/start"))
    response = client.get("/api/auth/google/callback",
                          query_string={"error": "access_denied", "state": fake.asked["state"]})
    assert told(response) == "/login?google=cancelled"
    assert fake.requests == []


def test_no_code_fails(client, fake):
    fake.go(client.get("/api/auth/google/start"))
    response = client.get("/api/auth/google/callback", query_string={"state": fake.asked["state"]})
    assert told(response) == "/login?google=failed"


def test_a_refused_trade_fails(client, fake, monkeypatch):
    fake.go(client.get("/api/auth/google/start"))
    monkeypatch.setattr(fake, "asked", {**fake.asked, "code_challenge": "another"})
    assert told(fake.come_back(client)) == "/login?google=failed"
    assert signed_in(client) == {"user": None}


# --- the ID token's checks ------------------------------------------------------------------------

def good_claims(**changes):
    return {"iss": "accounts.google.com", "aud": CLIENT_ID, "exp": 2_000_000_000, "nonce": "n",
            "sub": "1", "email": "a@b.io", **changes}


def test_a_good_token_passes(fake):
    assert google.checked_claims(id_token(good_claims()), "n", now=1_999_999_000)["sub"] == "1"
    # Several audiences, when this app is the one it was issued to.
    claims = good_claims(aud=[CLIENT_ID, "other"], azp=CLIENT_ID)
    assert google.checked_claims(id_token(claims), "n", now=0)["sub"] == "1"


@pytest.mark.parametrize("changes, now", [
    ({"iss": "https://accounts.evil.example"}, 0),
    ({"aud": "someone-elses-client"}, 0),
    ({"aud": [CLIENT_ID, "other"], "azp": "other"}, 0),
    ({"exp": 1000}, 1061),
    ({"exp": None}, 0),
    ({"nonce": "another sign-in's"}, 0),
    ({"nonce": None}, 0),
    ({"sub": ""}, 0),
    ({"email": None}, 0),
])
def test_a_token_that_fails_a_check_is_refused(fake, changes, now):
    with pytest.raises(google.GoogleError):
        google.checked_claims(id_token(good_claims(**changes)), "n", now=now)


def test_a_minute_of_clock_difference_is_allowed(fake):
    assert google.checked_claims(id_token(good_claims(exp=1000)), "n", now=1059)


@pytest.mark.parametrize("token", ["", "one-part", "a.!!!.c", "a." + base64.urlsafe_b64encode(b"[1]").decode() + ".c"])
def test_an_unreadable_token_is_refused(fake, token):
    with pytest.raises(google.GoogleError):
        google.checked_claims(token, "n", now=0)


def test_the_trade_is_a_post_to_googles_token_endpoint(app, fake, monkeypatch):
    monkeypatch.undo()  # the real request_tokens, with urlopen faked instead
    sent = []

    def urlopen(request, timeout):
        sent.append((request, timeout))
        return io.BytesIO(b'{"id_token": "x.y.z"}')

    monkeypatch.setattr(google, "urlopen", urlopen)
    assert google.request_tokens({"code": "c", "code_verifier": "v"}) == {"id_token": "x.y.z"}
    request, timeout = sent[0]
    assert request.full_url == google.TOKEN_URL and request.get_method() == "POST"
    assert parse_qs(request.data.decode()) == {"code": ["c"], "code_verifier": ["v"]}
    assert timeout


@pytest.mark.parametrize("failure", [
    URLError("no route"),
    HTTPError(google.TOKEN_URL, 400, "Bad Request", {}, io.BytesIO(b'{"error": "invalid_grant"}')),
    TimeoutError(),
])
def test_a_failed_trade_is_a_google_error(app, monkeypatch, failure):
    def urlopen(request, timeout):
        raise failure
    monkeypatch.setattr(google, "urlopen", urlopen)
    with pytest.raises(google.GoogleError):
        google.request_tokens({})


def test_an_answer_that_isnt_json_is_a_google_error(app, monkeypatch):
    monkeypatch.setattr(google, "urlopen", lambda request, timeout: io.BytesIO(b"<html>"))
    with pytest.raises(google.GoogleError):
        google.request_tokens({})


# --- connecting Google to an account with a password ----------------------------------------------

def connect(client, password="password"):
    return client.post("/api/auth/google/connect", json={"password": password})


def test_connecting_asks_for_the_password(client, fake):
    login(client, "owner@test.io")
    assert connect(client, "wrong").get_json() == {"errors": ["That password is incorrect."]}
    assert connect(client, "").get_json() == {"errors": ["Enter your password to connect Google."]}
    with client.session_transaction() as session:
        assert "google_flow" not in session, "no trip to Google without the password"


def test_connecting_then_signing_in_with_google(client, fake, ids):
    login(client, "owner@test.io")
    response = connect(client)
    assert response.status_code == 200
    fake.person = {"email": "olive@gmail.com", "sub": "google-olive"}
    fake.asked = {key: values[0] for key, values in parse_qs(urlsplit(response.get_json()["url"]).query).items()}
    assert told(fake.come_back(client)) == "/settings?google=connected"
    assert signed_in(client)["googleConnected"] is True
    assert db.session.get(User, ids["owner"]).google_sub == "google-olive"

    client.get("/api/auth/logout")
    fake.sign_in(client, email="olive@gmail.com", sub="google-olive")
    assert signed_in(client)["id"] == ids["owner"]


def start_connecting(client, fake, email):
    login(client, email)
    url = connect(client).get_json()["url"]
    fake.asked = {key: values[0] for key, values in parse_qs(urlsplit(url).query).items()}


def test_a_google_account_connects_to_one_whelp_account(client, fake, ids):
    fake.sign_in(client)  # jane's account, made with google-1001
    client.get("/api/auth/logout")
    start_connecting(client, fake, "owner@test.io")
    assert told(fake.come_back(client)) == "/settings?google=in-use"
    assert db.session.get(User, ids["owner"]).google_sub is None


def test_a_connection_finishes_for_whoever_started_it(client, fake, ids):
    start_connecting(client, fake, "owner@test.io")
    flow = None
    with client.session_transaction() as session:
        flow = session["google_flow"]
    client.get("/api/auth/logout")
    login(client, "reviewer@test.io")
    with client.session_transaction() as session:
        session["google_flow"] = flow
    assert told(fake.come_back(client)) == "/settings?google=expired"
    assert db.session.get(User, ids["reviewer"]).google_sub is None
    assert db.session.get(User, ids["owner"]).google_sub is None


def test_an_account_connects_one_google_account(client, fake):
    login(client, "owner@test.io")
    owner = User.query.filter_by(email="owner@test.io").one()
    owner.google_sub = "google-olive"
    db.session.commit()
    assert connect(client).get_json() == {"errors": ["A Google account is already connected."]}


def test_connecting_needs_google_to_be_set_up(client):
    login(client, "owner@test.io")
    response = connect(client)
    assert response.status_code == 503


def test_the_demo_account_connects_nothing(client, fake):
    db.session.add(User(username="Demo", email=DEMO_EMAIL, password="password",
                        first_name="Demo", last_name="User"))
    db.session.commit()
    login(client, DEMO_EMAIL)
    response = connect(client)
    assert response.status_code == 403
    assert "everyone shares it" in response.get_json()["errors"][0]


def test_disconnecting_leaves_the_password(client, fake, ids):
    start_connecting(client, fake, "owner@test.io")
    fake.come_back(client)
    response = client.delete("/api/auth/google")
    assert response.status_code == 200 and response.get_json()["googleConnected"] is False
    assert db.session.get(User, ids["owner"]).google_sub is None
    assert client.delete("/api/auth/google").get_json() == {"errors": ["No Google account is connected."]}


def test_an_account_with_only_google_keeps_it(client, fake):
    fake.sign_in(client)
    response = client.delete("/api/auth/google")
    assert response.status_code == 400
    assert "Set a password" in response.get_json()["errors"][0]
    assert signed_in(client)["googleConnected"] is True


# --- a passwordless account confirming with Google ---------------------------------------------------

def test_signing_in_with_google_confirms_for_ten_minutes(client, fake):
    fake.sign_in(client)
    assert client.get("/api/auth/google").get_json()["confirmed"] is True
    backdate_confirmation(client, google.CONFIRMATION_SECONDS + 1)
    assert client.get("/api/auth/google").get_json()["confirmed"] is False


def test_confirming_again_with_the_same_google_account(client, fake):
    fake.sign_in(client)
    backdate_confirmation(client, google.CONFIRMATION_SECONDS + 1)
    fake.go(client.get("/api/auth/google/start?intent=confirm"))
    assert told(fake.come_back(client)) == "/settings?google=confirmed"
    assert client.get("/api/auth/google").get_json()["confirmed"] is True


def test_another_google_account_doesnt_confirm(client, fake):
    fake.sign_in(client)
    backdate_confirmation(client, google.CONFIRMATION_SECONDS + 1)
    fake.go(client.get("/api/auth/google/start?intent=confirm"))
    fake.person = {"sub": "google-someone-else"}
    assert told(fake.come_back(client)) == "/settings?google=wrong-account"
    assert client.get("/api/auth/google").get_json()["confirmed"] is False


def test_confirming_needs_someone_signed_in(client, fake):
    assert told(client.get("/api/auth/google/start?intent=confirm")) == "/login"


def test_logging_out_forgets_the_confirmation(client, fake):
    start_connecting(client, fake, "owner@test.io")
    fake.come_back(client)
    assert client.get("/api/auth/google").get_json()["confirmed"] is True
    client.get("/api/auth/logout")
    login(client, "owner@test.io")
    assert client.get("/api/auth/google").get_json()["confirmed"] is False


def jane(client):
    return signed_in(client)["id"]


def test_a_first_password_needs_a_fresh_confirmation(client, fake):
    fake.sign_in(client)
    backdate_confirmation(client, google.CONFIRMATION_SECONDS + 1)
    response = client.put(f"/api/users/{jane(client)}/password", json={"new_password": "a-new-password"})
    assert response.status_code == 403
    assert response.get_json() == {"errors": ["Confirm it's you with Google first."]}
    assert User.query.filter_by(email="jane.doe@gmail.com").one().hashed_password is None


def test_setting_a_first_password(client, fake):
    fake.sign_in(client)
    user_id = jane(client)
    short = client.put(f"/api/users/{user_id}/password", json={"new_password": "short"})
    assert short.status_code == 400 and "at least 8" in short.get_json()["errors"][0]

    response = client.put(f"/api/users/{user_id}/password", json={"new_password": "a-new-password"})
    assert response.get_json() == {"message": "Your password has been set."}
    assert signed_in(client)["hasPassword"] is True

    client.get("/api/auth/logout")
    assert login(client, "jane.doe@gmail.com", "a-new-password")["id"] == user_id
    # And from now on, changing it asks for it, like anyone's.
    response = client.put(f"/api/users/{user_id}/password", json={"new_password": "another-password"})
    assert response.status_code == 400


def test_deleting_a_passwordless_account_needs_a_fresh_confirmation(client, fake):
    fake.sign_in(client)
    user_id = jane(client)
    backdate_confirmation(client, google.CONFIRMATION_SECONDS + 1)
    refused = client.delete(f"/api/users/{user_id}", json={})
    assert refused.status_code == 403
    assert refused.get_json() == {"errors": ["Confirm it's you with Google first."]}

    fake.go(client.get("/api/auth/google/start?intent=confirm"))
    fake.come_back(client)
    assert client.delete(f"/api/users/{user_id}", json={}).status_code == 200
    assert db.session.get(User, user_id) is None
    assert signed_in(client) == {"user": None}


def test_a_confirmation_is_for_the_account_that_made_it(client, fake, ids):
    """Signed in with Google as jane, then as owner in the same browser: owner hasn't confirmed anything."""
    fake.sign_in(client)
    client.get("/api/auth/logout")
    with client.session_transaction() as session:
        session["google_confirmed"] = {"user_id": jane_id_for("jane.doe@gmail.com"), "at": time.time()}
    login(client, "owner@test.io")
    owner = db.session.get(User, ids["owner"])
    owner.hashed_password = None
    db.session.commit()
    assert client.delete(f"/api/users/{ids['owner']}", json={}).status_code == 403


def jane_id_for(email):
    return User.query.filter_by(email=email).one().id


# --- the migration ----------------------------------------------------------------------------------

MIGRATION = (pathlib.Path(__file__).resolve().parents[1] / "migrations" / "versions"
             / "d2a7f4c9e815_sign_in_with_google.py")


@pytest.fixture()
def migration():
    spec = importlib.util.spec_from_file_location("sign_in_with_google", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(step, connection):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    with Operations.context(MigrationContext.configure(connection)):
        step()


def insert(connection, id, email, password, google_sub=None):
    columns = "id, username, email, hashed_password, first_name, last_name"
    values = ":id, :username, :email, :password, 'F', 'L'"
    params = {"id": id, "username": f"user{id}", "email": email, "password": password}
    if google_sub is not None:
        columns += ", google_sub"
        values += ", :sub"
        params["sub"] = google_sub
    connection.execute(text(f"INSERT INTO users ({columns}) VALUES ({values})"), params)


# Batch mode reflects the table to rebuild it, and says it left the
# expression index out -- which is why the migration puts it back.
@pytest.mark.filterwarnings("ignore:Skipped unsupported reflection of expression-based index")
def test_the_migration_adds_google_and_lets_the_password_go(migration, tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}")
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(40) NOT NULL UNIQUE, "
            "email VARCHAR(255) NOT NULL UNIQUE, hashed_password VARCHAR(255) NOT NULL, "
            "first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL)"))
        connection.execute(text("CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email))"))
        insert(connection, 1, "owner@test.io", "hash")

        run(migration.upgrade, connection)
        columns = {column["name"]: column for column in inspect(connection).get_columns("users")}
        assert columns["hashed_password"]["nullable"] is True
        assert columns["google_sub"]["nullable"] is True
        insert(connection, 2, "jane@gmail.com", None, google_sub="g-1")
        with pytest.raises(IntegrityError):
            with connection.begin_nested():
                insert(connection, 3, "other@gmail.com", None, google_sub="g-1")
        # #117's rule survives SQLite rebuilding the table.
        with pytest.raises(IntegrityError):
            with connection.begin_nested():
                insert(connection, 3, "OWNER@test.io", "hash")

        run(migration.downgrade, connection)
        columns = {column["name"]: column for column in inspect(connection).get_columns("users")}
        assert "google_sub" not in columns
        assert columns["hashed_password"]["nullable"] is False
        assert connection.execute(text("SELECT hashed_password FROM users WHERE id = 2")).scalar() == "!"
        with pytest.raises(IntegrityError):
            with connection.begin_nested():
                insert(connection, 3, "OWNER@test.io", "hash")


def test_the_model_declares_the_index_the_migration_builds(migration):
    """The suite's database is made from the models: one without the index tests a rule production has."""
    index = next(index for index in User.__table__.indexes if index.name == migration.INDEX_NAME)
    assert index.unique and [column.name for column in index.columns] == ["google_sub"]


def test_the_unusable_hash_matches_no_password(migration):
    from werkzeug.security import check_password_hash
    for password in ("", "!", "password"):
        assert check_password_hash(migration.UNUSABLE_HASH, password) is False
