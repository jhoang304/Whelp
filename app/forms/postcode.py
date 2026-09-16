"""
The one postcode rule, shared by the form validator and mirrored by
`react-app/src/utils/postcode.ts`. Keep the two in step: a client that
accepts more than the server does is how issue #19 happened.
"""
from wtforms.validators import StopValidation

# Alphanumeric groups joined by single spaces or hyphens, with no separator
# at either end: 02134, 77003-1234, M5V 3L9, SW1A 1AA all pass; !!!, A--B and
# a trailing space do not.
POSTCODE_REGEX = r"^[A-Za-z0-9]+([ -][A-Za-z0-9]+)*$"
POSTCODE_MIN = 3
POSTCODE_MAX = 10
POSTCODE_MESSAGE = (
    "Postal code must be letters and digits, separated by single spaces or "
    "hyphens (e.g. 02134, 77003-1234, M5V 3L9)"
)


def coerce_to_text(value):
    """
    Accept a JSON number where a postcode is expected.

    This column used to be an integer and the API took `"zipcode": 77003`, so
    existing callers still send numbers. Only real numbers are converted:
    `bool` is an `int` subclass in Python, and stringifying it would turn
    `"zipcode": true` into the perfectly well-formed postcode "True".
    Everything else is left alone for `postcode_type` to reject.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return str(value)
    return value


def postcode_type(form, field):
    """
    Reject a postcode that is not text before any length check sees it.

    Length() calls len() on whatever it is given, so a bool or a dict reaching
    it raises TypeError and surfaces as a 500 rather than a 400. StopValidation
    ends the chain here instead.
    """
    if not isinstance(field.data, str):
        raise StopValidation(POSTCODE_MESSAGE)
