from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import DataRequired, Length, URL


class RestaurantForm(FlaskForm):
    name = StringField("name",validators=[DataRequired(), Length(min=1, max=100)])
    price = StringField("price",validators=[DataRequired()])
    address = StringField("address",validators=[DataRequired(), Length(min=1, max=100)])
    city = StringField("city",validators=[DataRequired(), Length(min=1, max=50)])
    state = StringField("state",validators=[DataRequired(), Length(min=2, max=2)])
    zipcode = StringField("zipcode",validators=[DataRequired(), Length(min=3, max=10)])
    country = StringField("country",validators=[DataRequired(), Length(min=1, max=56)])
    phone_number = StringField("phone_number",validators=[DataRequired(), Length(min=1, max=20)])
    website = StringField("website",validators=[DataRequired(), Length(min=1, max=70)])
    description= StringField("description",validators=[DataRequired(), Length(min=1, max=500)])
