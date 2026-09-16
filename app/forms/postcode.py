"""
The one postcode rule, shared by the form validator and mirrored by
`react-app/src/utils/postcode.ts`. Keep the two in step: a client that
accepts more than the server does is how issue #19 happened.
"""
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
    existing callers still send numbers. Without this the number reaches
    Length(), which calls len() on an int and raises TypeError -- an
    unhandled 500 where the old API returned 200. Anything that is not a
    plain postcode string still fails the format check and gets a 400.
    """
    if value is None or isinstance(value, str):
        return value
    return str(value)
