from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired
from app.models import User

class UserProfileForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    first_name = StringField('First_Name')
    last_name = StringField('Last_Name')
    email_address = StringField('Email')
