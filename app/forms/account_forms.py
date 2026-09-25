from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Length

from .signup_form import PASSWORD_MIN_LENGTH


class ChangePasswordForm(FlaskForm):
    """
    The current password, and the one to replace it.

    Whether the current one is right is the route's question, not a validator
    here: a validator would need the user, and the route already has them.
    The new one follows the rule signup does, down to the message.
    """
    current_password = StringField('current_password', validators=[
        DataRequired(message="Enter your current password.")])
    new_password = StringField('new_password', validators=[
        DataRequired(message="Enter a new password."),
        Length(min=PASSWORD_MIN_LENGTH,
               message=f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")])


class DeleteAccountForm(FlaskForm):
    """Deleting an account asks for its password, whoever's session it is."""
    password = StringField('password', validators=[
        DataRequired(message="Enter your password to delete your account.")])
