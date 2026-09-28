from flask_wtf import FlaskForm
from wtforms.validators import DataRequired, Length

from .fields import TextField


class ReviewResponseForm(FlaskForm):
    response = TextField(
        "response",
        validators=[
            DataRequired(message="Response text is required."),
            Length(min=1, max=1000, message="Responses must be between 1 and 1000 characters."),
        ],
    )
