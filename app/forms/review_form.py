from flask_wtf import FlaskForm

from wtforms.validators import DataRequired, Length, NumberRange

from .fields import TextField, WholeNumberField

class ReviewForm(FlaskForm):

  review = TextField("review", validators=[DataRequired(), Length(min=1, max=255)])
  rating = WholeNumberField("rating", validators=[DataRequired(), NumberRange(min = 1, max = 5)])
