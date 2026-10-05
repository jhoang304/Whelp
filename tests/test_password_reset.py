"""
Resetting a forgotten password by email: who gets a link, what it carries,
how long it lasts, and what it can't be made to do.

Resend is faked at the one place the app calls it, mail.post_to_resend, and
the email is sent at once rather than after the response, so a test can
read it.
"""
import io
import json
import logging
import re
import threading
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs

import pytest
from flask import current_app
from itsdangerous import URLSafeTimedSerializer
from itsdangerous.timed import TimestampSigner

from app.api import mail, password_reset
from app.api.password_reset_routes import EXPIRED, SENT, UNAVAILABLE
from app.extensions import limiter
from app.models import User, db
from app.models.user import DEMO_EMAIL
from tests.conftest import login, visit

LINK = re.compile(r"https://whelp\.test/reset-password#([\w.-]+)")


@pytest.fixture()
def outbox(app, monkeypatch):
    monkeypatch.setitem(app.config, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setitem(app.config, "MAIL_FROM", "Whelp <noreply@whelp.test>")
    monkeypatch.setitem(app.config, "PUBLIC_URL", "https://whelp.test")
    sent = []
    monkeypatch.setattr(mail, "post_to_resend", lambda message: sent.append(message) or {"id": "email-1"})
    monkeypatch.setattr(mail, "in_background", lambda work: work())
    return sent


@pytest.fixture()
def production(monkeypatch):
    monkeypatch.setattr(mail, "is_production", lambda: True)
    monkeypatch.setattr(password_reset, "is_production", lambda: True)


def ask(client, email, **kwargs):
    visit(client)
    return client.post("/api/auth/password-reset", json={"email": email}, **kwargs)


def token_from(message):
    return LINK.search(message["text"]).group(1)


def link_for(client, outbox, email="owner@test.io"):
    ask(client, email)
    return token_from(outbox[-1])


def reset(client, token, new_password="a-new-password"):
    visit(client)
    return client.put("/api/auth/password-reset", json={"token": token, "new_password": new_password})


def check(client, token):
    visit(client)
    return client.post("/api/auth/password-reset/check", json={"token": token})


def logs_in(client, email, password):
    visit(client)
    return client.post("/api/auth/login", json={"email": email, "password": password}).status_code == 200


# --- whether it's offered -------------------------------------------------------------

def test_development_offers_it_without_resend(client):
    assert client.get("/api/auth/password-reset").get_json() == {"available": True}


def test_production_doesnt_without_resend(client, production):
    assert client.get("/api/auth/password-reset").get_json() == {"available": False}
    response = ask(client, "owner@test.io")
    assert response.status_code == 503 and response.get_json() == {"errors": [UNAVAILABLE]}


def test_production_needs_to_know_where_the_site_is(app, client, outbox, production, monkeypatch):
    monkeypatch.delitem(app.config, "PUBLIC_URL")
    assert client.get("/api/auth/password-reset").get_json() == {"available": False}
    monkeypatch.setitem(app.config, "PUBLIC_URL", "https://whelp.test")
    assert client.get("/api/auth/password-reset").get_json() == {"available": True}


# --- asking for a link ---------------------------------------------------------------------

def test_an_account_gets_a_link_by_email(client, outbox):
    response = ask(client, "owner@test.io")
    assert response.status_code == 200 and response.get_json() == {"message": SENT}
    [message] = outbox
    assert message["to"] == ["owner@test.io"]
    assert message["from"] == "Whelp <noreply@whelp.test>"
    assert message["subject"] == "Reset your Whelp password"
    assert message["text"].startswith("Hi Olive,")
    token = token_from(message)
    assert f'href="https://whelp.test/reset-password#{token}"' in message["html"]
    assert "Hi Olive," in message["html"]


def test_the_address_in_any_case(client, outbox):
    ask(client, "  OWNER@Test.io ")
    assert [message["to"] for message in outbox] == [["owner@test.io"]]


def test_nobodys_address_gets_the_same_answer_and_no_email(client, outbox):
    theirs = ask(client, "owner@test.io")
    nobodys = ask(client, "nobody@test.io")
    assert (nobodys.status_code, nobodys.get_json()) == (theirs.status_code, theirs.get_json())
    assert len(outbox) == 1


def test_the_demo_gets_the_same_answer_and_no_email(client, outbox):
    db.session.add(User(username="Demo", email=DEMO_EMAIL, password="password",
                        first_name="Demo", last_name="User"))
    db.session.commit()
    response = ask(client, DEMO_EMAIL)
    assert response.get_json() == {"message": SENT}
    assert outbox == []


@pytest.mark.parametrize("email, error", [
    ("", "Enter your email address."),
    ("not-an-address", "Please enter a valid email address."),
])
def test_an_address_that_isnt_one_is_refused(client, outbox, email, error):
    response = ask(client, email)
    assert response.status_code == 400 and response.get_json() == {"errors": [error]}


def test_the_email_goes_after_the_response(client, outbox, monkeypatch):
    """Sending takes as long as Resend does: waited for, it would say which addresses have accounts."""
    later = []
    monkeypatch.setattr(mail, "in_background", later.append)
    assert ask(client, "owner@test.io").status_code == 200
    assert outbox == [] and len(later) == 1
    later[0]()
    assert len(outbox) == 1


def test_a_name_is_text_in_the_html(client, outbox, ids):
    db.session.get(User, ids["owner"]).first_name = "<b>Olive</b>"
    db.session.commit()
    ask(client, "owner@test.io")
    assert "&lt;b&gt;Olive&lt;/b&gt;" in outbox[0]["html"]
    assert "<b>Olive</b>" not in outbox[0]["html"]


def test_the_link_doesnt_come_from_the_host_header(app, outbox, production):
    """A link built from it would send someone's token wherever the request said."""
    with app.test_request_context("/api/auth/password-reset", method="POST",
                                  headers={"Host": "evil.example"}):
        assert password_reset.link_for("the-token") == "https://whelp.test/reset-password#the-token"


def test_development_without_a_public_url_links_to_where_it_runs(app, client, outbox, monkeypatch):
    monkeypatch.delitem(app.config, "PUBLIC_URL")
    ask(client, "owner@test.io")
    assert "http://localhost/reset-password#" in outbox[0]["text"]


def test_development_without_resend_writes_the_email_to_the_log(client, monkeypatch, caplog):
    monkeypatch.setattr(mail, "in_background", lambda work: work())
    with caplog.at_level(logging.WARNING):
        ask(client, "owner@test.io")
    assert "RESEND_API_KEY" in caplog.text
    assert "http://localhost/reset-password#" in caplog.text


def test_production_never_writes_an_email_to_the_log(app, production, caplog):
    with app.app_context(), caplog.at_level(logging.DEBUG):
        with pytest.raises(mail.MailError):
            mail.send("owner@test.io", "Reset", "the link: https://whelp.test/reset-password#secret", "")
    assert "secret" not in caplog.text


def test_a_failed_send_is_logged_without_the_link(client, outbox, monkeypatch, caplog):
    def refuse(message):
        raise mail.MailError("Resend refused it (403): The whelp.test domain is not verified")
    monkeypatch.setattr(mail, "post_to_resend", refuse)
    with caplog.at_level(logging.ERROR):
        response = ask(client, "owner@test.io")
    assert response.get_json() == {"message": SENT}
    assert "domain is not verified" in caplog.text
    assert "reset-password#" not in caplog.text


# --- using one ------------------------------------------------------------------------------

def test_a_link_sets_a_new_password_and_signs_you_in(client, outbox, ids):
    token = link_for(client, outbox)
    assert check(client, token).get_json() == {"valid": True}

    response = reset(client, token)
    assert response.status_code == 200 and response.get_json()["id"] == ids["owner"]
    assert client.get("/api/auth/").get_json()["id"] == ids["owner"]

    client.get("/api/auth/logout")
    assert not logs_in(client, "owner@test.io", "password")
    assert logs_in(client, "owner@test.io", "a-new-password")


def test_a_link_works_once(client, outbox):
    token = link_for(client, outbox)
    assert reset(client, token).status_code == 200
    again = reset(client, token, "a-third-password")
    assert again.status_code == 400 and again.get_json() == {"errors": [EXPIRED]}
    assert check(client, token).status_code == 400


def test_any_new_password_ends_the_links_made_before_it(client, outbox, ids):
    token = link_for(client, outbox)
    login(client, "owner@test.io")
    client.put(f"/api/users/{ids['owner']}/password",
               json={"current_password": "password", "new_password": "changed-it-myself"})
    assert reset(client, token).get_json() == {"errors": [EXPIRED]}


def made_ago(app, ids, monkeypatch, seconds):
    """Owner's token, as if made `seconds` ago. Only its making is moved: the CSRF token keeps time too."""
    now = TimestampSigner.get_timestamp(None)
    with monkeypatch.context() as patched:
        patched.setattr(TimestampSigner, "get_timestamp", lambda self: now - seconds)
        with app.test_request_context():
            return password_reset.token_for(db.session.get(User, ids["owner"]))


def test_a_link_lasts_an_hour(app, client, ids, monkeypatch):
    late = made_ago(app, ids, monkeypatch, password_reset.MAX_AGE_SECONDS + 1)
    assert check(client, late).get_json() == {"errors": [EXPIRED]}
    in_time = made_ago(app, ids, monkeypatch, password_reset.MAX_AGE_SECONDS - 60)
    assert check(client, in_time).get_json() == {"valid": True}


def test_a_short_password_is_refused_and_the_link_kept(client, outbox):
    token = link_for(client, outbox)
    response = reset(client, token, "short")
    assert response.status_code == 400
    assert response.get_json() == {"errors": ["Password must be at least 8 characters."]}
    assert reset(client, token).status_code == 200


def test_no_token_says_the_link_is_incomplete(client):
    response = reset(client, "")
    assert response.get_json()["errors"] == ["This link is incomplete. Open the one in the email again."]


def test_an_account_made_with_google_can_set_a_password_this_way(client, outbox):
    db.session.add(User(username="jane", email="jane@gmail.com", first_name="Jane", last_name="Doe",
                        google_sub="g-jane"))
    db.session.commit()
    token = link_for(client, outbox, "jane@gmail.com")
    assert reset(client, token).status_code == 200
    client.get("/api/auth/logout")
    assert logs_in(client, "jane@gmail.com", "a-new-password")


def test_a_deleted_accounts_link_opens_nothing(client, outbox, ids):
    token = link_for(client, outbox, "bystander@test.io")
    db.session.delete(db.session.get(User, ids["bystander"]))
    db.session.commit()
    assert check(client, token).get_json() == {"errors": [EXPIRED]}


def test_the_demo_cant_be_reset_even_with_a_token(app, client):
    demo = User(username="Demo", email=DEMO_EMAIL, password="password", first_name="Demo", last_name="User")
    db.session.add(demo)
    db.session.commit()
    with app.test_request_context():
        token = password_reset.token_for(demo)
    assert reset(client, token).get_json() == {"errors": [EXPIRED]}


def forged(app, ids):
    owner = db.session.get(User, ids["owner"])
    salt = f"password-reset:{owner.id}:{owner.hashed_password}"
    with app.test_request_context():
        real = password_reset.token_for(owner)
    payload, rest = real.split(".", 1)
    reviewer_payload = URLSafeTimedSerializer("x").dumps(ids["reviewer"]).split(".", 1)[0]
    return {
        "garbage": "not-a-token",
        "signed with another secret": URLSafeTimedSerializer("another-secret").dumps(owner.id, salt=salt),
        "signed for something else": URLSafeTimedSerializer(app.config["SECRET_KEY"]).dumps(owner.id),
        "another account's id, owner's signature": f"{reviewer_payload}.{rest}",
        "a payload that isn't an id": URLSafeTimedSerializer(app.config["SECRET_KEY"]).dumps(
            True, salt=salt),
        "far too long": real + "x" * 400,
    }


def test_forged_tokens_open_nothing(app, client, ids):
    for name, token in forged(app, ids).items():
        assert check(client, token).get_json() == {"errors": [EXPIRED]}, name
        assert reset(client, token).get_json() == {"errors": [EXPIRED]}, name
    assert logs_in(client, "owner@test.io", "password")


# --- how often ----------------------------------------------------------------------------------

@pytest.fixture()
def rate_limited(app):
    limiter.enabled = True
    limiter.reset()
    yield
    limiter.reset()
    limiter.enabled = False


def test_one_address_gets_three_emails_an_hour(client, outbox, rate_limited):
    statuses = [ask(client, "owner@test.io").status_code for _ in range(4)]
    assert statuses == [200, 200, 200, 429]
    assert len(outbox) == 3
    # Counted for that address, not for whoever asked.
    assert ask(client, "reviewer@test.io").status_code == 200


def test_one_caller_asks_ten_times_a_minute(client, outbox, rate_limited):
    statuses = [ask(client, f"person{number}@test.io").status_code for number in range(11)]
    assert statuses[:10] == [200] * 10 and statuses[10] == 429


# --- talking to Resend --------------------------------------------------------------------------

def test_an_email_is_a_post_to_resend(app, monkeypatch):
    sent = []

    def urlopen(request, timeout):
        sent.append((request, timeout))
        return io.BytesIO(b'{"id": "email-1"}')

    monkeypatch.setattr(mail, "urlopen", urlopen)
    monkeypatch.setitem(app.config, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setitem(app.config, "MAIL_FROM", "Whelp <noreply@whelp.test>")
    with app.app_context():
        mail.send("owner@test.io", "Subject", "Text", "<p>Html</p>")

    request, timeout = sent[0]
    assert request.full_url == "https://api.resend.com/emails" and request.get_method() == "POST"
    assert request.get_header("Authorization") == "Bearer re_test_key"
    assert request.get_header("Content-type") == "application/json"
    assert request.get_header("User-agent") == "Whelp/1.0", "Resend refuses a request without one"
    assert json.loads(request.data) == {"from": "Whelp <noreply@whelp.test>", "to": ["owner@test.io"],
                                        "subject": "Subject", "text": "Text", "html": "<p>Html</p>"}
    assert timeout


@pytest.mark.parametrize("failure, says", [
    (HTTPError("https://api.resend.com/emails", 403, "Forbidden", {},
               io.BytesIO(b'{"message": "The whelp.test domain is not verified"}')), "domain is not verified"),
    (URLError("no route to host"), "couldn't be reached"),
    (TimeoutError(), "couldn't be reached"),
])
def test_a_failed_post_is_a_mail_error_that_says_why(app, monkeypatch, failure, says):
    def urlopen(request, timeout):
        raise failure
    monkeypatch.setattr(mail, "urlopen", urlopen)
    monkeypatch.setitem(app.config, "RESEND_API_KEY", "re_test_key")
    with app.app_context(), pytest.raises(mail.MailError, match=says):
        mail.post_to_resend({})


def test_in_background_runs_on_its_own_thread_in_the_apps_context(app):
    finished = threading.Event()
    seen = {}

    def work():
        seen["thread"] = threading.current_thread()
        seen["secret"] = current_app.config["SECRET_KEY"]
        finished.set()

    with app.test_request_context():
        mail.in_background(work)
    assert finished.wait(5)
    assert seen["thread"] is not threading.main_thread()
    assert seen["secret"] == app.config["SECRET_KEY"]
