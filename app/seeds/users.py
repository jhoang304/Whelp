from datetime import datetime, timedelta

from app.models import db, User, environment, SCHEMA
from sqlalchemy.sql import text


# Deterministic cartoon avatars so seeded profiles have a picture without
# depending on photos of real people.
def avatar(seed):
    return f"https://api.dicebear.com/9.x/avataaars/svg?seed={seed}"


# Stagger join dates so "Member since ..." on profile pages looks real.
FIRST_SIGNUP = datetime(2023, 8, 8, 9, 30, 0)


def joined(days_after_launch):
    return FIRST_SIGNUP + timedelta(days=days_after_launch)


# Adds a demo user, you can add other users here if you want
def seed_users():
    demo = User(
        username='Demo', email='demo@aa.io', password='password', first_name="Demo", last_name="User",
        profile_image_url=avatar("Demo"), createdAt=joined(0), updatedAt=joined(0))
    marnie = User(
        username='marnie', email='marnie@aa.io', password='password', first_name="Marnie", last_name="Johnson",
        profile_image_url=avatar("Marnie"), createdAt=joined(3), updatedAt=joined(3))
    bobbie = User(
        username='bobbie', email='bobbie@aa.io', password='password', first_name="Bobbie", last_name="Jackson",
        profile_image_url=avatar("Bobbie"), createdAt=joined(11), updatedAt=joined(11))
    alice = User(
        username='alice', email='alice@aa.io', password='password', first_name="Alice", last_name="Smith",
        profile_image_url=avatar("Alice"), createdAt=joined(40), updatedAt=joined(40))
    john = User(
        username='john', email='john@aa.io', password='password', first_name="John", last_name="Doe",
        profile_image_url=avatar("John"), createdAt=joined(97), updatedAt=joined(97))
    # A reviewer with no avatar yet, to exercise the default-avatar fallback.
    sam = User(
        username='sam', email='sam@aa.io', password='password', first_name="Sam", last_name="Rivera",
        createdAt=joined(400), updatedAt=joined(400))

    db.session.add_all([demo, marnie, bobbie, alice, john, sam])
    db.session.commit()


# Uses a raw SQL query to TRUNCATE or DELETE the users table. SQLAlchemy doesn't
# have a built in function to do this. With postgres in production TRUNCATE
# removes all the data from the table, and RESET IDENTITY resets the auto
# incrementing primary key, CASCADE deletes any dependent entities.  With
# sqlite3 in development you need to instead use DELETE to remove all data and
# it will reset the primary keys for you as well.
def undo_users():
    if environment == "production":
        db.session.execute(text(f"TRUNCATE table {SCHEMA}.users RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text("DELETE FROM users"))

    db.session.commit()
