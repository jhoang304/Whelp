from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Length, Optional


class UserProfileForm(FlaskForm):
    username = StringField(
        'username',
        validators=[
            DataRequired(message="Username is required."),
            Length(min=1, max=40, message="Username must be 40 characters or fewer."),
        ],
    )
    first_name = StringField('first_name', validators=[Optional(), Length(max=50, message="First name must be 50 characters or fewer.")])
    last_name = StringField('last_name', validators=[Optional(), Length(max=50, message="Last name must be 50 characters or fewer.")])
    profile_image_url = StringField('profile_image_url', validators=[Optional(), Length(max=255, message="Profile image URL must be 255 characters or fewer.")])
