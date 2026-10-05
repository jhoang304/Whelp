from flask_wtf import FlaskForm
from wtforms.validators import DataRequired, Email, Length

from .fields import TextField, email_address
from .signup_form import PASSWORD_MIN_LENGTH


class ChangePasswordForm(FlaskForm):
    """
    The current password, and the one to replace it.

    Whether the current one is right is the route's question, not a validator
    here: a validator would need the user, and the route already has them.
    The new one follows the rule signup does, down to the message.
    """
    current_password = TextField('current_password', validators=[
        DataRequired(message="Enter your current password.")])
    new_password = TextField('new_password', validators=[
        DataRequired(message="Enter a new password."),
        Length(min=PASSWORD_MIN_LENGTH,
               message=f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")])


class SetPasswordForm(FlaskForm):
    """
    A first password, for an account made with Google: the rule signup
    follows, and no current one to give.
    """
    new_password = TextField('new_password', validators=[
        DataRequired(message="Enter a new password."),
        Length(min=PASSWORD_MIN_LENGTH,
               message=f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")])


class ConnectGoogleForm(FlaskForm):
    """Connecting a Google account asks for the password, as changing it does."""
    password = TextField('password', validators=[
        DataRequired(message="Enter your password to connect Google.")])


class PasswordResetRequestForm(FlaskForm):
    """The address to email a reset link to."""
    email = TextField('email', filters=[email_address], validators=[
        DataRequired(message="Enter your email address."),
        Email(message="Please enter a valid email address.")])


class PasswordResetForm(FlaskForm):
    """A reset link's token, and the new password: the rule signup follows."""
    token = TextField('token', validators=[
        DataRequired(message="This link is incomplete. Open the one in the email again.")])
    new_password = TextField('new_password', validators=[
        DataRequired(message="Enter a new password."),
        Length(min=PASSWORD_MIN_LENGTH,
               message=f"Password must be at least {PASSWORD_MIN_LENGTH} characters.")])


class DeleteAccountForm(FlaskForm):
    """Deleting an account asks for its password, whoever's session it is."""
    password = TextField('password', validators=[
        DataRequired(message="Enter your password to delete your account.")])
