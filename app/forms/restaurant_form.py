from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Length, Regexp

from .phone import phone_format
from .postcode import (
    coerce_to_text, postcode_type,
    POSTCODE_MAX, POSTCODE_MESSAGE, POSTCODE_MIN, POSTCODE_REGEX,
)


class RestaurantForm(FlaskForm):
    """
    Messages name their own field: the API answers with a flat list of them,
    so WTForms' "Field must be between 1 and 50 characters long" would leave
    the reader of a ten-field form guessing which box to fix.
    """
    name = StringField("name", validators=[
        DataRequired(message="Restaurant name is required."),
        Length(min=1, max=100, message="Restaurant name must be 100 characters or fewer.")])
    price = StringField("price", validators=[
        DataRequired(message="Price is required.")])
    address = StringField("address", validators=[
        DataRequired(message="Address is required."),
        Length(min=1, max=100, message="Address must be 100 characters or fewer.")])
    city = StringField("city", validators=[
        DataRequired(message="City is required."),
        Length(min=1, max=50, message="City must be 50 characters or fewer.")])
    state = StringField("state", validators=[
        DataRequired(message="State is required."),
        Length(min=2, max=2, message="State must be a 2-letter abbreviation.")])
    zipcode = StringField("zipcode", filters=[coerce_to_text], validators=[
        DataRequired(message="Postal code is required."),
        postcode_type,
        Length(min=POSTCODE_MIN, max=POSTCODE_MAX,
               message=f"Postal code must be between {POSTCODE_MIN} and {POSTCODE_MAX} characters."),
        Regexp(POSTCODE_REGEX, message=POSTCODE_MESSAGE)])
    country = StringField("country", validators=[
        DataRequired(message="Country is required."),
        Length(min=1, max=56, message="Country must be 56 characters or fewer.")])
    phone_number = StringField("phone_number", validators=[
        DataRequired(message="Phone number is required."),
        Length(min=1, max=20, message="Phone number must be 20 characters or fewer."),
        phone_format])
    website = StringField("website", validators=[
        DataRequired(message="Website is required."),
        Length(min=1, max=70, message="Website must be 70 characters or fewer.")])
    description = StringField("description", validators=[
        DataRequired(message="Description is required."),
        Length(min=1, max=500, message="Description must be 500 characters or fewer.")])
