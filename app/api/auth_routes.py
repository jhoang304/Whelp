from flask import Blueprint, request
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash
from app.models import User, db
from app.forms import LoginForm
from app.forms import SignUpForm
from app.api import google
from app.api.utils import error_messages
from app.extensions import limiter
from flask_login import current_user, login_user, logout_user, login_required

auth_routes = Blueprint('auth', __name__)

# Checked against when no account has the email, so a login with an unknown
# address costs the same password check as one with a known address and the
# wrong password. Refusing the first at once, and taking 100 ms over the
# second, told anyone timing it which addresses have accounts (#117).
UNKNOWN_ACCOUNT_HASH = generate_password_hash("no account has this address")


@auth_routes.route('/')
def authenticate():
    """
    Who is signed in: their user, or {"user": null} when nobody is.

    The app asks on every page load, and being signed out is an answer, not an
    error: a 401 here was a red line in every signed-out visitor's console
    (#126). Routes that need a user still refuse with a 401.
    """
    if current_user.is_authenticated:
        return current_user.to_dict()
    return {'user': None}


@auth_routes.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """
    Logs a user in
    """
    form = LoginForm()
    # Get the csrf_token from the request cookie and put it into the
    # form manually to validate_on_submit can be used
    form['csrf_token'].data = request.cookies.get('csrf_token')
    if not form.validate_on_submit():
        return {'errors': ['Invalid credentials']}, 401

    # One lookup and one password check, whether or not the address has an
    # account. The form checks nothing about the account itself any more. An
    # account made with Google has no password for any to match, and is
    # refused like an unknown address, at the same cost: saying "use Google"
    # would tell anyone typing the address that it has an account.
    user = User.with_email(form.data['email'])
    if user is None or not user.has_password:
        check_password_hash(UNKNOWN_ACCOUNT_HASH, form.data['password'])
        return {'errors': ['Invalid credentials']}, 401
    if not user.check_password(form.data['password']):
        return {'errors': ['Invalid credentials']}, 401

    login_user(user)
    return user.to_dict()


@auth_routes.route('/logout')
def logout():
    """
    Logs a user out
    """
    logout_user()
    google.forget()
    return {'message': 'User logged out'}


@auth_routes.route('/signup', methods=['POST'])
@limiter.limit("10 per minute")
def sign_up():
    """
    Creates a new user and logs them in
    """
    form = SignUpForm()
    form['csrf_token'].data = request.cookies.get('csrf_token')
    if form.validate_on_submit():
        user = User(
            username=form.data['username'],
            email=form.data['email'],
            first_name=form.data['first_name'],
            last_name=form.data['last_name'],
            password=form.data['password']
        )
        db.session.add(user)
        try:
            db.session.commit()
        except IntegrityError:
            # Two signups for one address or username at once both pass the
            # form's checks, and the database refuses the second: say which,
            # as the form would have, not "Something went wrong" (#119).
            db.session.rollback()
            taken = []
            if User.with_email(form.data['email']):
                taken.append('Email address is already in use.')
            if User.username_taken(form.data['username']):
                taken.append('Username is already in use.')
            if taken:
                return {'errors': taken}, 409
            raise
        login_user(user)
        return user.to_dict()
    return {'errors': error_messages(form.errors)}, 400

