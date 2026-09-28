"""
Fields that refuse a value of the wrong type before any validator sees it.

Flask-WTF turns a JSON body into form data with ImmutableMultiDict(json), so
a field receives whatever type the JSON held. StringField kept it, and
Length() then called len() on a number: a TypeError, and a 500 where a 400
belonged. A list became several values, of which the form checked the first.
IntegerField turned `true` into a 1-star rating and 4.7 into 4 without a word
(#111). pre_validate runs before a field's validators, so these stop the
chain with a message instead.

A null counts as absent, left to DataRequired or Optional: clearing a profile
picture sends one.
"""
from wtforms import IntegerField, StringField
from wtforms.validators import StopValidation


class TextField(StringField):
    """A StringField that takes exactly one string."""

    def pre_validate(self, form):
        if not self.raw_data or self.raw_data[0] is None:
            return
        if len(self.raw_data) > 1 or not isinstance(self.raw_data[0], str):
            raise StopValidation(f"{self.name} must be text.")


class WholeNumberField(IntegerField):
    """An IntegerField that refuses booleans, fractions and lists rather than rounding them."""

    def pre_validate(self, form):
        if not self.raw_data or self.raw_data[0] is None:
            return
        value = self.raw_data[0]
        fraction = isinstance(value, float) and not value.is_integer()
        if len(self.raw_data) > 1 or isinstance(value, bool) or fraction:
            raise StopValidation(f"{self.name} must be a whole number.")
