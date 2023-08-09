from flask_wtf import FlaskForm
from wtforms import IntegerField, StringField
from wtforms.validators import DataRequired


class RestaurantForm(FlaskForm):
    name = StringField("name",validators=[DataRequired()])
    price = StringField("price",validators=[DataRequired()])
    address = StringField("address",validators=[DataRequired()])
    city = StringField("city",validators=[DataRequired()])
    state = StringField("state",validators=[DataRequired()])
    zipcode = IntegerField("zipcode",validators=[DataRequired()])
    country = StringField("country",validators=[DataRequired()])
    phone_number = StringField("phone_number",validators=[DataRequired()])
    website = StringField("website",validators=[DataRequired()])
    description= StringField("description",validators=[DataRequired()])
