"""
Sending email: through Resend's API where it is set up, and into the log
where it isn't -- which only development allows.

An HTTPS API rather than SMTP because Render's free web services block the
SMTP ports. No library: one POST, which the standard library covers.
"""
import json
import threading
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import current_app

from app.environment import is_production

RESEND_URL = "https://api.resend.com/emails"
# Resend turns away a request with no User-Agent (a 403, "error 1010"),
# and urllib's own is one of those it refuses.
USER_AGENT = "Whelp/1.0"


class MailError(Exception):
    """An email wasn't sent: not set up, refused, or Resend couldn't be reached."""


def is_configured():
    config = current_app.config
    return bool(config.get("RESEND_API_KEY") and config.get("MAIL_FROM"))


def can_send():
    """Whether an email can go anywhere: to Resend, or in development, to the log."""
    return is_configured() or not is_production()


def send(to, subject, text, html):
    """Send an email, or in development without Resend, write it to the log instead."""
    if not is_configured():
        if is_production():
            # Never into a production log: what it carries is someone's way in.
            raise MailError("RESEND_API_KEY and MAIL_FROM aren't set")
        current_app.logger.warning(
            "Email not sent -- RESEND_API_KEY isn't set. To %s: %s\n\n%s", to, subject, text)
        return
    post_to_resend({
        "from": current_app.config["MAIL_FROM"],
        "to": [to],
        "subject": subject,
        "text": text,
        "html": html,
    })


def post_to_resend(message):
    """POST one email to Resend and return its answer: the one place this calls Resend."""
    request = Request(RESEND_URL, data=json.dumps(message).encode("utf-8"), method="POST", headers={
        "Authorization": f"Bearer {current_app.config['RESEND_API_KEY']}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    })
    try:
        with urlopen(request, timeout=10) as response:
            return json.load(response)
    except HTTPError as error:
        # Resend says what was wrong with it: a domain not verified, a bad key.
        detail = error.read()[:500].decode("utf-8", "replace")
        raise MailError(f"Resend refused it ({error.code}): {detail}") from error
    except (URLError, OSError, ValueError) as error:
        raise MailError(f"Resend couldn't be reached: {error}") from error


def in_background(work):
    """
    Run `work` after the response, in the app's context. Sending takes as
    long as Resend does, and a request that waited for it would take longer
    for an address with an account than for one without -- which says which
    addresses have one.
    """
    app = current_app._get_current_object()

    def run():
        with app.app_context():
            work()

    threading.Thread(target=run, daemon=True).start()
