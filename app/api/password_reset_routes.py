"""
Resetting a forgotten password, at /api/auth/password-reset.

Asking answers the same whatever the address -- an account's, nobody's, or
the shared demo's -- and the email goes out after the response, so neither
what comes back nor how long it takes says which addresses have accounts.
"""
from flask import Blueprint, current_app, request
from flask_limiter.util import get_remote_address
from flask_login import login_user

from app.api import mail, password_reset
from app.api.utils import error_messages
from app.extensions import limiter
from app.forms import PasswordResetForm, PasswordResetRequestForm
from app.models import User, db

password_reset_routes = Blueprint('password_reset', __name__)

SENT = ("If an account uses that address, we've emailed it a link to reset the password. "
        "The link works for an hour.")
UNAVAILABLE = "Resetting a password by email isn't available right now."
EXPIRED = "This link has expired or has already been used. Ask for a new one."


def _per_address():
    """
    Counted per address as well as per caller: someone with many addresses
    to send from could otherwise fill one person's inbox.
    """
    body = request.get_json(silent=True)
    email = body.get('email') if isinstance(body, dict) else None
    if isinstance(email, str) and email.strip():
        return f"password-reset:{email.strip().lower()}"
    return get_remote_address()


@password_reset_routes.route('', methods=['GET'])
def status():
    """
    {"available": whether a reset can be asked for here}. It needs Resend
    (RESEND_API_KEY, MAIL_FROM) and PUBLIC_URL in production; development
    writes the email to the log instead.
    """
    return {'available': password_reset.is_available()}


@password_reset_routes.route('', methods=['POST'])
@limiter.limit("10 per minute")
@limiter.limit("3 per hour", key_func=_per_address)
def ask():
    """
    Email a link to reset the password: {"email"}. Answers the same message
    whether or not an account uses the address.
    """
    if not password_reset.is_available():
        return {'errors': [UNAVAILABLE]}, 503
    form = PasswordResetRequestForm()
    form['csrf_token'].data = request.cookies.get('csrf_token')
    if not form.validate_on_submit():
        return {'errors': error_messages(form.errors)}, 400

    user = User.with_email(form.data['email'])
    if user is not None and not user.is_demo:
        # Made here, where the request is; sent after the response.
        address = user.email
        email = password_reset.email_for(user, password_reset.link_for(password_reset.token_for(user)))
        mail.in_background(lambda: _send(address, email))
    return {'message': SENT}


def _send(address, email):
    try:
        mail.send(address, email['subject'], email['text'], email['html'])
    except mail.MailError as error:
        # Never the link: it is a way into the account.
        current_app.logger.error("A password reset email wasn't sent: %s", error)


@password_reset_routes.route('/check', methods=['POST'])
@limiter.limit("20 per minute")
def check():
    """
    Whether a link's token is still good, before a new password is typed for
    it: {"token"}. Answers {"valid": true}, or a 400 saying it isn't.
    """
    body = request.get_json(silent=True) or {}
    if password_reset.user_for(body.get('token')) is None:
        return {'errors': [EXPIRED]}, 400
    return {'valid': True}


@password_reset_routes.route('', methods=['PUT'])
@limiter.limit("10 per minute")
def reset():
    """
    Choose a new password with a link's token: {"token", "new_password"}.
    The new one follows the signup rule. Signs you in, and answers your user.
    The link is used up: its signature covered the old password.
    """
    form = PasswordResetForm()
    form['csrf_token'].data = request.cookies.get('csrf_token')
    if not form.validate_on_submit():
        return {'errors': error_messages(form.errors)}, 400
    user = password_reset.user_for(form.data['token'])
    if user is None:
        return {'errors': [EXPIRED]}, 400

    user.password = form.data['new_password']
    db.session.commit()
    login_user(user)
    return user.to_dict()
