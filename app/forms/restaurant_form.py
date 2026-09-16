from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Length, Regexp

from .postcode import (
    coerce_to_text, postcode_type,
    POSTCODE_MAX, POSTCODE_MESSAGE, POSTCODE_MIN, POSTCODE_REGEX,
)


class RestaurantForm(FlaskForm):
    name = StringField("name",validators=[DataRequired(), Length(min=1, max=100)])
    price = StringField("price",validators=[DataRequired()])
    address = StringField("address",validators=[DataRequired(), Length(min=1, max=100)])
    city = StringField("city",validators=[DataRequired(), Length(min=1, max=50)])
    state = StringField("state",validators=[DataRequired(), Length(min=2, max=2)])
    zipcode = StringField("zipcode",filters=[coerce_to_text],validators=[DataRequired(), postcode_type, Length(min=POSTCODE_MIN, max=POSTCODE_MAX), Regexp(POSTCODE_REGEX, message=POSTCODE_MESSAGE)])
    country = StringField("country",validators=[DataRequired(), Length(min=1, max=56)])
    phone_number = StringField("phone_number",validators=[DataRequired(), Length(min=1, max=20)])
    website = StringField("website",validators=[DataRequired(), Length(min=1, max=70)])
    description= StringField("description",validators=[DataRequired(), Length(min=1, max=500)])
