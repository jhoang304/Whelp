from flask_wtf import FlaskForm

from wtforms import IntegerField, StringField
from wtforms.validators import DataRequired, NumberRange

class ReviewForm(FlaskForm):

  review = StringField("review", validators=[DataRequired()])
  rating = IntegerField("rating", validators=[DataRequired(), NumberRange(min = 1, max = 5)])
