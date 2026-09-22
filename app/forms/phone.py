"""
The one phone rule, shared by the form validator and mirrored by
`react-app/src/utils/phone.ts`. Keep the two in step.

The rule this replaces was "must contain a digit", which is what was left
after an allowlist of digits, spaces, hyphens and parentheses turned out to
reject `+1 555 123 4567` -- for want of a plus. That was the right thing to
loosen and the wrong amount: it also accepts `(346) 571-7931asdf`.

So: the punctuation the world writes numbers with, and no letters, except an
extension on the end. A vanity number such as 1-800-FLOWERS is rejected --
the one legitimate thing this turns away, and dialling it means typing the
digits anyway.
"""
import re

from wtforms.validators import StopValidation

# `x99`, `ext 99`, `ext. 99`, after a comma, semicolon or space.
PHONE_EXTENSION = re.compile(r"(?:[,;]|\s)*(?:ext|extn|x)\.?\s*\d+\s*$", re.IGNORECASE)
PHONE_CHARACTERS = re.compile(r"^[\d+()\-./\s]+$")
PHONE_MESSAGE = (
    "Phone number can contain digits and + ( ) - . / only, with an optional "
    "extension (e.g. (555) 555-5555 x99)"
)


def strip_extension(value):
    """The number without a trailing extension, which may carry letters."""
    return PHONE_EXTENSION.sub("", value).strip()


def is_valid_phone(value):
    if not isinstance(value, str):
        return False
    return bool(PHONE_CHARACTERS.match(strip_extension(value)))


def phone_format(form, field):
    """Reject a phone number carrying anything but digits and punctuation."""
    if field.data and not is_valid_phone(field.data):
        raise StopValidation(PHONE_MESSAGE)
