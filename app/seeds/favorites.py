from app.models import db, environment, SCHEMA
from sqlalchemy.sql import text


# Nothing is seeded: a saved list is its owner's to make. This is here so
# `flask seed undo` clears favorites before the users and restaurants they
# point at -- SQLite does not enforce the foreign keys, so a favorite left
# behind would quietly outlive both.
def undo_favorites():
    if environment == "production":
        db.session.execute(text(f"TRUNCATE table {SCHEMA}.favorites RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text("DELETE FROM favorites"))

    db.session.commit()
