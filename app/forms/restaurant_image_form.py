import re

from flask_wtf import FlaskForm
from wtforms import BooleanField
from wtforms.validators import DataRequired, Length, Regexp

from .fields import TextField

class RestaurantImageForm(FlaskForm):
    url = TextField("url", validators=[
        DataRequired(message="Image URL is required."),
        # The column is 255 characters. Past it, Postgres refused the INSERT
        # and the API answered a 500; SQLite never noticed (#111).
        Length(max=255, message="Image URL must be 255 characters or fewer."),
        Regexp(r"^https?://.+", flags=re.IGNORECASE,
               message="Image URL must start with http:// or https://.")])
    preview = BooleanField("preview")
