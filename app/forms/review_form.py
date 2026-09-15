from flask_wtf import FlaskForm

from wtforms import IntegerField, StringField
from wtforms.validators import DataRequired, Length, NumberRange

class ReviewForm(FlaskForm):

  review = StringField("review", validators=[DataRequired(), Length(min=1, max=255)])
  rating = IntegerField("rating", validators=[DataRequired(), NumberRange(min = 1, max = 5)])
