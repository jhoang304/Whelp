"""
What a search box query matches (#118).

The query used to be one phrase, matched as it was typed inside one field at
a time, so the searches the box invites -- a cuisine and a place, "burgers
chicago" -- found nothing. `%` and `_` went into the LIKE pattern as they
were, so "%" matched every restaurant. And the state, stored as a two-letter
code, could never be matched: "TX" was too short to be looked for there and
"Texas" too long to be found inside it.

Now each word is a term, and a restaurant matches when every term matches
one of its fields: name, city, cuisine, description, or state -- by its code
or its full name.
"""
from sqlalchemy import and_, case, func, or_

from app.api.hours import STATE_TIMEZONES

# Full names, for "Texas" and "new york" as well as "TX" and "NY". The codes
# are the ones STATE_TIMEZONES knows, which is every one a restaurant can be in.
STATE_CODES_BY_NAME = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "district of columbia": "DC",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID", "illinois": "IL",
    "indiana": "IN", "iowa": "IA", "kansas": "KS", "kentucky": "KY", "louisiana": "LA",
    "maine": "ME", "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
    "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
    "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT", "virginia": "VA",
    "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
}

# The names of more than one word, longest first, so "west virginia" is read
# before "virginia" could be.
_STATE_PHRASES = sorted((name for name in STATE_CODES_BY_NAME if " " in name), key=len, reverse=True)

# Words that join a query rather than narrow it: "sushi in houston" would
# otherwise need "in" to appear in a restaurant too. Only dropped from a
# query that has other words; "in" on its own is still looked for.
FILLER_WORDS = {"in", "at", "near", "the", "and", "of", "on", "&"}

# A term this short matches too much of a description to be useful, so it is
# looked for in the name and city (and as a state code) only.
MIN_DESCRIPTION_TERM = 3

ESCAPE = "\\"


def search_terms(keyword):
    """
    The terms of a query, lower-cased: a state's name of several words kept
    as one term ("new york"), everything else split on whitespace, and the
    filler words dropped.
    """
    text = f" {' '.join(keyword.lower().split())} "
    phrases = []
    for name in _STATE_PHRASES:
        if f" {name} " in text:
            phrases.append(name)
            text = text.replace(f" {name} ", " ")
    words = text.split()
    kept = [word for word in words if word not in FILLER_WORDS]
    return phrases + (kept if kept or phrases else words)


def state_code(term):
    """The state a term names, by its code ("tx") or its name ("texas"), or None."""
    code = term.upper()
    if len(code) == 2 and code in STATE_TIMEZONES:
        return code
    return STATE_CODES_BY_NAME.get(term)


def like_pattern(term):
    """
    "%term%", with the term's own % and _ matching themselves. Unescaped, "%"
    matched every restaurant and "_" any one character.
    """
    escaped = term.replace(ESCAPE, ESCAPE * 2).replace("%", ESCAPE + "%").replace("_", ESCAPE + "_")
    return f"%{escaped}%"


def keyword_match(keyword):
    """
    (matches, relevance) for a search: every term matching some field, and
    an order that puts a restaurant named for the whole query first, then
    one named for part of it, then one serving it, then any other mention.
    """
    from app.models import Category, Restaurant, db, restaurant_categories

    def contains(column, pattern):
        return column.ilike(pattern, escape=ESCAPE)

    def serves(pattern):
        return Restaurant.id.in_(
            db.session.query(restaurant_categories.c.restaurant_id).join(
                Category, Category.id == restaurant_categories.c.category_id
            ).filter(contains(Category.name, pattern))
        )

    each_term = []
    name_hits = []
    category_hits = []
    for term in search_terms(keyword):
        pattern = like_pattern(term)
        name_hit = contains(Restaurant.name, pattern)
        fields = [name_hit, contains(Restaurant.city, pattern)]
        name_hits.append(name_hit)
        if len(term) >= MIN_DESCRIPTION_TERM:
            # "Italian" is what people type into a search box, and it is what a
            # restaurant serves, not what it wrote into its description.
            category_hit = serves(pattern)
            fields += [category_hit, contains(Restaurant.description, pattern)]
            category_hits.append(category_hit)
        code = state_code(term)
        if code:
            fields.append(func.upper(Restaurant.state) == code)
        each_term.append(or_(*fields))

    ranks = [(and_(*name_hits), 0), (or_(*name_hits), 1)]
    if category_hits:
        ranks.append((or_(*category_hits), 2))
    return and_(*each_term), case(*ranks, else_=3)
