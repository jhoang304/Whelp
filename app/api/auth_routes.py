from flask import Blueprint, request
from werkzeug.security import check_password_hash, generate_password_hash
from app.models import User, db
from app.forms import LoginForm
from app.forms import SignUpForm
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
    Authenticates a user.
    """
    if current_user.is_authenticated:
        return current_user.to_dict()
    return {'errors': ['Unauthorized']}, 401


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
    # account. The form checks nothing about the account itself any more.
    user = User.with_email(form.data['email'])
    if user is None:
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
        db.session.commit()
        login_user(user)
        return user.to_dict()
    return {'errors': error_messages(form.errors)}, 400


@auth_routes.route('/unauthorized')
def unauthorized():
    """
    Returns unauthorized JSON when flask-login authentication fails
    """
    return {'errors': ['Unauthorized']}, 401
