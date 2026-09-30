from flask_wtf import FlaskForm
from wtforms.validators import DataRequired, Email, ValidationError, Length
from app.models import User
from .fields import TextField, email_address, trimmed

# Mirrored in react-app/src/components/SignupFormPage, which checks it before
# the round trip. Keep the two in step.
PASSWORD_MIN_LENGTH = 8


def user_exists(form, field):
    # Whatever case either is written in: the same address is one account.
    if User.with_email(field.data):
        raise ValidationError('Email address is already in use.')


def username_exists(form, field):
    if User.username_taken(field.data):
        raise ValidationError('Username is already in use.')


class SignUpForm(FlaskForm):
    """
    Messages name their own field: the API answers with a flat list of them,
    so "Field must be between 1 and 40 characters long" would leave the signup
    form's reader guessing which box to fix.
    """
    username = TextField('username', filters=[trimmed], validators=[
        DataRequired(message="Username is required."),
        username_exists,
        Length(min=1, max=40, message="Username must be 40 characters or fewer.")])
    email = TextField('email', filters=[email_address], validators=[
        DataRequired(message="Email is required."),
        user_exists,
        Email(message="Please enter a valid email address."),
        Length(min=1, max=50, message="Email must be 50 characters or fewer.")])
    first_name = TextField('first_name', filters=[trimmed], validators=[
        DataRequired(message="First name is required."),
        Length(min=1, max=50, message="First name must be 50 characters or fewer.")])
    last_name = TextField('last_name', filters=[trimmed], validators=[
        DataRequired(message="Last name is required."),
        Length(min=1, max=50, message="Last name must be 50 characters or fewer.")])
    password = TextField('password', validators=[
        DataRequired(message="Password is required."),
        Length(min=PASSWORD_MIN_LENGTH,
               message=f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")])
