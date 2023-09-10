from flask import Blueprint, jsonify, request
from flask_login import login_required
from app.models import User, db
from app.forms import UserProfileForm
from app.api.auth_routes import authenticate

user_routes = Blueprint('users', __name__)


@user_routes.route('/')
@login_required
def users():
    """
    Query for all users and returns them in a list of user dictionaries
    """
    users = User.query.all()
    return {'users': [user.to_dict() for user in users]}


@user_routes.route('/<int:id>')
@login_required
def user(id):
    """
    Query for a user by id and returns that user in a dictionary
    """
    user = User.query.get(id)
    return user.to_dict()

@user_routes.route('/get/<int:id>', methods=['GET'])
def get_user_profile(id):
    profile = User.query.filter(User.id == id).all()
    return profile[0].to_dict()


@user_routes.route('/<int:id>/edit', methods=['PUT'])
@login_required
def edit_profile(id):
    if authenticate():
        form = UserProfileForm()
        profile = User.query.get(id)
        if not profile:
            return {'errors': ['The profile does not exist']}, 401
        form['csrf_token'].data = request.cookies['csrf_token']
        data = form.data

        if profile and form.validate_on_submit():
            profile.username = data['username']
            db.session.commit()
            return profile.to_dict()
        return form.errors
