from flask_wtf import FlaskForm
from wtforms import IntegerField, StringField
from wtforms.validators import DataRequired, Length, URL


class RestaurantForm(FlaskForm):
    name = StringField("name",validators=[DataRequired(), Length(min=1, max=100)])
    price = StringField("price",validators=[DataRequired()])
    address = StringField("address",validators=[DataRequired(), Length(min=1, max=50)])
    city = StringField("city",validators=[DataRequired(), Length(min=1, max=85)])
    state = StringField("state",validators=[DataRequired(), Length(min=2, max=2)])
    zipcode = IntegerField("zipcode",validators=[DataRequired()])
    country = StringField("country",validators=[DataRequired(), Length(min=1, max=56)])
    phone_number = StringField("phone_number",validators=[DataRequired(), Length(min=1, max=20)])
    website = StringField("website",validators=[DataRequired(), Length(min=1, max=70), URL(require_tld=True)])
    description= StringField("description",validators=[DataRequired(), Length(min=1, max=500)])
