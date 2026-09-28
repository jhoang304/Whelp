from flask_wtf import FlaskForm
from wtforms.validators import DataRequired, Email, ValidationError
from app.models import User
from .fields import TextField


def user_exists(form, field):
    # Checking if user exists
    email = field.data
    user = User.query.filter(User.email == email).first()
    if not user:
        raise ValidationError('Email provided not found.')


def password_matches(form, field):
    # Checking if password matches
    password = field.data
    email = form.data['email']
    if not isinstance(email, str):
        # The email field has already said what is wrong with it; querying
        # with a number is a type error on Postgres (#111).
        raise ValidationError('No such user exists.')
    user = User.query.filter(User.email == email).first()
    if not user:
        raise ValidationError('No such user exists.')
    if not user.check_password(password):
        raise ValidationError('Password was incorrect.')


class LoginForm(FlaskForm):
    email = TextField('email', validators=[DataRequired(), user_exists])
    password = TextField('password', validators=[DataRequired(), password_matches])