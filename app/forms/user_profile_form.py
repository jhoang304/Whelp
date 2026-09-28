from flask_wtf import FlaskForm
from wtforms.validators import DataRequired, Length, Optional

from .fields import TextField


class UserProfileForm(FlaskForm):
    username = TextField(
        'username',
        validators=[
            DataRequired(message="Username is required."),
            Length(min=1, max=40, message="Username must be 40 characters or fewer."),
        ],
    )
    first_name = TextField('first_name', validators=[Optional(), Length(max=50, message="First name must be 50 characters or fewer.")])
    last_name = TextField('last_name', validators=[Optional(), Length(max=50, message="Last name must be 50 characters or fewer.")])
    profile_image_url = TextField('profile_image_url', validators=[Optional(), Length(max=255, message="Profile image URL must be 255 characters or fewer.")])
