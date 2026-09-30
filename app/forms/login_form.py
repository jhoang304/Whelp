from flask_wtf import FlaskForm
from wtforms.validators import DataRequired
from .fields import TextField


class LoginForm(FlaskForm):
    """
    Only that both are there, and text. Whether they match an account is the
    route's to answer, once: these validators used to look the user up and
    check the password, and then the route did both again -- two password
    checks for every login, and none at all for an unknown email, so how
    long a refusal took said whether the address had an account (#117).
    The address is matched whatever its case by User.with_email.
    """
    email = TextField('email', validators=[DataRequired()])
    password = TextField('password', validators=[DataRequired()])
