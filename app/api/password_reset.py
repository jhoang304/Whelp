"""
Resetting a forgotten password by email: the link, and the email it goes in.

A link carries a token: the account's id, signed with the app's secret and
stamped with the time. Its signature also covers the account's password
hash, so it stops working the moment the password changes -- including when
the link itself is used to change it, which makes each link good once.
Nothing is stored: there is no table of tokens to keep, expire or leak.

The token goes after the # in the link, which a browser never sends: it
isn't in the server's access log, or the Referer of anything the page loads.
"""
from html import escape

from flask import current_app, request
from itsdangerous import BadData, URLSafeTimedSerializer

from app.api import mail
from app.environment import is_production
from app.models import User, db

SALT = "password-reset"
MAX_AGE_SECONDS = 60 * 60
# Longer than any token this makes: a bigger one is someone else's.
TOKEN_MAX_LENGTH = 300


def is_available():
    """
    Whether a reset can be asked for: email can be sent, and in production,
    PUBLIC_URL says where the link should point.
    """
    return mail.can_send() and bool(current_app.config.get("PUBLIC_URL") or not is_production())


def _serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"])


def _salt(user):
    # The password hash, so a new password -- set by this link or any other
    # way -- ends every link made before it.
    return f"{SALT}:{user.id}:{user.hashed_password or ''}"


def token_for(user):
    return _serializer().dumps(user.id, salt=_salt(user))


def user_for(token):
    """The account a token was made for, while it's good: None once expired, used, or not ours."""
    if not isinstance(token, str) or not token or len(token) > TOKEN_MAX_LENGTH:
        return None
    serializer = _serializer()
    try:
        # Unchecked, only to find whose salt to check it with.
        _, user_id = serializer.loads_unsafe(token)
    except BadData:
        return None
    if isinstance(user_id, bool) or not isinstance(user_id, int):
        return None
    user = db.session.get(User, user_id)
    # Everyone who tries the demo shares it; nobody resets its password.
    if user is None or user.is_demo:
        return None
    try:
        serializer.loads(token, salt=_salt(user), max_age=MAX_AGE_SECONDS)
    except BadData:
        return None
    return user


def link_for(token):
    """
    The page that takes the token. Where it points comes from PUBLIC_URL,
    not from the request: a request's Host header is whatever its sender
    wrote, and a link built from it could send someone's token to another
    site. Only development falls back to the request.
    """
    base = current_app.config.get("PUBLIC_URL") or (None if is_production() else request.host_url)
    return f"{base.rstrip('/')}/reset-password#{token}"


def email_for(user, link):
    """{"subject", "text", "html"} for the email that carries a link."""
    name = user.first_name or user.username
    text = (
        f"Hi {name},\n\n"
        "Someone -- hopefully you -- asked to reset the password for your Whelp account. "
        "To choose a new one, open this link in the next hour:\n\n"
        f"{link}\n\n"
        "If it wasn't you, you can ignore this email. Your password stays as it is.\n\n"
        "Whelp\n"
    )
    html = f"""<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;color:#2d2e2f">
  <div style="max-width:480px;margin:0 auto;padding:32px;background:#ffffff;border-radius:12px">
    <h1 style="margin:0 0 16px;font-size:22px">Reset your password</h1>
    <p style="margin:0 0 16px;line-height:1.5">Hi {escape(name)},</p>
    <p style="margin:0 0 24px;line-height:1.5">Someone &ndash; hopefully you &ndash; asked to reset the
      password for your Whelp account. To choose a new one, use this button in the next hour.</p>
    <p style="margin:0 0 24px"><a href="{escape(link)}" style="display:inline-block;padding:12px 24px;
      background:#e00b12;color:#ffffff;border-radius:8px;font-weight:bold;text-decoration:none">Choose a new
      password</a></p>
    <p style="margin:0 0 8px;font-size:13px;color:#6b6b6b">Or open this link:</p>
    <p style="margin:0 0 24px;font-size:13px;word-break:break-all"><a href="{escape(link)}"
      style="color:#e00b12">{escape(link)}</a></p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#6b6b6b">If it wasn't you, you can ignore this
      email. Your password stays as it is.</p>
  </div>
</body>
</html>
"""
    return {"subject": "Reset your Whelp password", "text": text, "html": html}
