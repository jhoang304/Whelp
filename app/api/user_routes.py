from flask import Blueprint, request
from flask_login import login_required, current_user, logout_user
from sqlalchemy.sql import func

from app.models import Favorite, Restaurant, User, db
from app.forms import ChangePasswordForm, DeleteAccountForm, UserProfileForm
from app.api.accounts import delete_account, deletion_summary
from app.extensions import limiter
from app.api.utils import (
    error_messages, key_still_referenced, page_response, read_page_request, restaurant_cards)
from app.api.aws_helpers import key_uploaded_by, remove_key_from_s3

user_routes = Blueprint('users', __name__)


@user_routes.route('/')
@login_required
def users():
    """
    Query for all users and returns them in a list of user dictionaries.
    Email addresses are private; use GET /api/auth/ for your own account.
    """
    users = User.query.all()
    return {'users': [user.to_dict_public() for user in users]}


@user_routes.route('/<int:id>')
@login_required
def user(id):
    """
    Query for a user by id and returns that user in a dictionary.
    Email addresses are private; use GET /api/auth/ for your own account.
    """
    user = db.session.get(User, id)
    if not user:
        return {'errors': ["User couldn't be found"]}, 404
    return user.to_dict_public()


@user_routes.route('/get/<int:id>', methods=['GET'])
def get_user_profile(id):
    """
    Public profile for a user: name, username, avatar, join date, the
    businesses they own, and review/business counts. The email address is
    only included when the viewer is looking at their own profile.
    """
    profile = db.session.get(User, id)
    if not profile:
        return {'errors': ["User couldn't be found"]}, 404

    data = profile.to_dict_public()
    if current_user.is_authenticated and current_user.id == profile.id:
        data["email"] = profile.email
    data["restaurants"] = restaurant_cards(profile.restaurants)
    data["restaurant_count"] = len(profile.restaurants)
    data["review_count"] = len(profile.reviews)
    if current_user.is_authenticated and current_user.id == profile.id:
        # For the Saved tab's count. Nobody else is told how many there are.
        data["favorite_count"] = Favorite.query.filter_by(user_id=profile.id).count()
    return data


@user_routes.route('/<int:id>/favorites', methods=['GET'])
@login_required
def get_favorites(id):
    """
    A page of the restaurants a user has saved, most recently saved first, as
    the same cards the listing shows.

    Only the user themselves may read it: a saved list is a bookmark, not a
    recommendation, and saving somewhere should not tell anyone else.
    """
    if not db.session.get(User, id):
        return {'errors': ["User couldn't be found"]}, 404
    if current_user.id != id:
        return {'errors': ["You can only see your own saved restaurants"]}, 403

    page_request = read_page_request()
    if page_request.error:
        return {'errors': [page_request.error]}, 400

    query = (Restaurant.query
             .join(Favorite, Favorite.restaurant_id == Restaurant.id)
             .filter(Favorite.user_id == id)
             # Newest save first, with the id breaking ties so two saves in
             # the same second cannot swap places between pages.
             .order_by(Favorite.createdAt.desc(), Favorite.id.desc()))
    total = query.count()
    rows = query.limit(page_request.per_page).offset(page_request.offset).all()
    return page_response(restaurant_cards(rows), page_request, total)


@user_routes.route('/<int:id>/edit', methods=['PUT'])
@login_required
def edit_profile(id):
    """
    Update the logged-in user's own profile: username, first/last name, and
    profile picture URL (typically produced by POST /api/images/upload).
    Send "profile_image_url": "" to remove the current picture.
    """
    profile = db.session.get(User, id)
    if not profile:
        return {'errors': ['The profile does not exist']}, 404
    if profile.id != current_user.id:
        return {'errors': ['You can only edit your own profile']}, 403

    form = UserProfileForm()
    form['csrf_token'].data = request.cookies.get('csrf_token')
    if not form.validate_on_submit():
        return {'errors': error_messages(form.errors)}, 400

    data = form.data
    body = request.get_json(silent=True) or {}

    username = data['username'].strip()
    if not username:
        return {'errors': ['Username is required.']}, 400
    taken = User.query.filter(User.username == username, User.id != profile.id).first()
    if taken:
        return {'errors': ['Username is already in use.']}, 400
    profile.username = username

    first_name = (data.get('first_name') or '').strip()
    if first_name:
        profile.first_name = first_name
    last_name = (data.get('last_name') or '').strip()
    if last_name:
        profile.last_name = last_name

    replaced_key = None
    if 'profile_image_url' in body:
        new_url = (data.get('profile_image_url') or '').strip() or None
        old_key = profile.profile_image_key
        profile.profile_image_url = new_url
        profile.profile_image_key = key_uploaded_by(new_url, profile.id) if new_url else None
        if old_key and old_key != profile.profile_image_key:
            replaced_key = old_key

    profile.updatedAt = func.now()
    db.session.commit()

    # After the commit, and only for an object this user uploaded: pointing
    # this at a url was two calls away from deleting a stranger's picture.
    if replaced_key and not key_still_referenced(replaced_key):
        remove_key_from_s3(replaced_key)
    return profile.to_dict()


def _own_account(id):
    """The account at `id`, or the response refusing to act on it."""
    user = db.session.get(User, id)
    if not user:
        return None, ({'errors': ["User couldn't be found"]}, 404)
    if user.id != current_user.id:
        return None, ({'errors': ["You can only change your own account"]}, 403)
    return user, None


@user_routes.route('/<int:id>/password', methods=['PUT'])
@login_required
# It checks a password, so it is a place to guess one: the same limit as
# logging in.
@limiter.limit("10 per minute")
def change_password(id):
    """
    Change your password: {"current_password", "new_password"}.

    The current one is required even though you are logged in, so a session
    left open on a shared computer is not enough to take the account over.
    The new one follows the signup rule.
    """
    user, refusal = _own_account(id)
    if refusal:
        return refusal
    if user.is_demo:
        return {'errors': ["The demo account's password can't be changed: everyone shares it."]}, 403

    form = ChangePasswordForm()
    form['csrf_token'].data = request.cookies.get('csrf_token')
    if not form.validate_on_submit():
        return {'errors': error_messages(form.errors)}, 400

    if not user.check_password(form.data['current_password']):
        return {'errors': ["Your current password is incorrect."]}, 400
    if form.data['new_password'] == form.data['current_password']:
        return {'errors': ["Choose a new password that is different from your current one."]}, 400

    user.password = form.data['new_password']
    db.session.commit()
    return {'message': 'Your password has been changed.'}


@user_routes.route('/<int:id>/deletion', methods=['GET'])
@login_required
def account_deletion_summary(id):
    """
    What deleting your account would remove and keep, for the confirmation:
    the restaurants you own (each with its review count), how many of your
    reviews stay as "Deleted user", and how many photos and saved restaurants
    go.
    """
    user, refusal = _own_account(id)
    if refusal:
        return refusal
    return {**deletion_summary(user), 'isDemo': user.is_demo}


@user_routes.route('/<int:id>', methods=['DELETE'])
@login_required
@limiter.limit("10 per minute")
def delete_user(id):
    """
    Delete your account: {"password"}.

    Removes the restaurants you own with everything on them, every photo you
    added, your saved list and your avatar. Keeps the reviews you wrote, as
    by "Deleted user". Logs you out.
    """
    user, refusal = _own_account(id)
    if refusal:
        return refusal
    if user.is_demo:
        return {'errors': ["The demo account can't be deleted: everyone shares it."]}, 403

    form = DeleteAccountForm()
    form['csrf_token'].data = request.cookies.get('csrf_token')
    if not form.validate_on_submit():
        return {'errors': error_messages(form.errors)}, 400
    if not user.check_password(form.data['password']):
        return {'errors': ["That password is incorrect."]}, 400

    logout_user()
    delete_account(user)
    return {'message': 'Your account has been deleted.'}
