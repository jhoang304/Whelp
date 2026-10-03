"""
What the shared demo account may not do (#136).

Anyone can log in as the demo, and every later visitor sees what it leaves
behind. Its password and the account itself were already off limits; so,
now, is what can't be put back or would take other people's work with it:

- deleting one of its seeded restaurants, which took the reviews, replies
  and photos other people had left there;
- renaming one, since a name is how `flask seed demo-reset` finds it again;
- changing its profile;
- removing a photo someone else added to one of its restaurants.

Everything else -- the restaurants' other details, cuisines, hours, cover,
new photos, replies -- it may still change, to show the site off, and the
reset puts back on the next deploy.
"""
from app.seeds.restaurants import DEMO_RESTAURANT_NAMES

DELETE_RESTAURANT = ("The demo account's restaurants can't be deleted: everyone who tries "
                     "the demo shares them. You can still edit them.")
RENAME_RESTAURANT = ("The demo account's restaurants keep their names: everyone who tries "
                     "the demo shares them.")
EDIT_PROFILE = "The demo account's profile can't be changed: everyone who tries the demo shares it."
REMOVE_PHOTO = ("This photo can't be removed from a demo restaurant: everyone who tries the "
                "demo shares it. You can remove photos you added yourself.")


def is_demo_restaurant(restaurant):
    """One of the restaurants the demo account was seeded with."""
    return (restaurant is not None and restaurant.user is not None and restaurant.user.is_demo
            and restaurant.name in DEMO_RESTAURANT_NAMES)
