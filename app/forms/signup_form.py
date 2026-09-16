from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Email, ValidationError, Length
from app.models import User


def user_exists(form, field):
    # Checking if user exists
    email = field.data
    user = User.query.filter(User.email == email).first()
    if user:
        raise ValidationError('Email address is already in use.')


def username_exists(form, field):
    # Checking if username is already in use
    username = field.data
    user = User.query.filter(User.username == username).first()
    if user:
        raise ValidationError('Username is already in use.')


class SignUpForm(FlaskForm):
    """
    Messages name their own field: the API answers with a flat list of them,
    so "Field must be between 1 and 40 characters long" would leave the signup
    form's reader guessing which box to fix.
    """
    username = StringField('username', validators=[
        DataRequired(message="Username is required."),
        username_exists,
        Length(min=1, max=40, message="Username must be 40 characters or fewer.")])
    email = StringField('email', validators=[
        DataRequired(message="Email is required."),
        user_exists,
        Email(message="Please enter a valid email address."),
        Length(min=1, max=50, message="Email must be 50 characters or fewer.")])
    first_name = StringField('first_name', validators=[
        DataRequired(message="First name is required."),
        Length(min=1, max=50, message="First name must be 50 characters or fewer.")])
    last_name = StringField('last_name', validators=[
        DataRequired(message="Last name is required."),
        Length(min=1, max=50, message="Last name must be 50 characters or fewer.")])
    password = StringField('password', validators=[
        DataRequired(message="Password is required.")])
