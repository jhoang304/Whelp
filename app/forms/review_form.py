from flask_wtf import FlaskForm

from wtforms.validators import DataRequired, Length, NumberRange

from .fields import TextField, WholeNumberField

# The longest review taken: room for a real account of a meal, where the old
# String(255) column held about two sentences (#133). The column is TEXT, so
# this is the only limit; the client's MAX_REVIEW_LENGTH matches it.
MAX_REVIEW_LENGTH = 5000

class ReviewForm(FlaskForm):

  review = TextField("review", validators=[DataRequired(), Length(min=1, max=MAX_REVIEW_LENGTH)])
  rating = WholeNumberField("rating", validators=[DataRequired(), NumberRange(min = 1, max = 5)])
