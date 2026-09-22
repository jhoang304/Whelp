from .db import db, environment, SCHEMA, add_prefix_for_prod


class RestaurantHours(db.Model):
    """
    One row per day a restaurant is open.

    A day with no row is a day it is closed, and a restaurant with no rows at
    all has simply never said -- which is not the same thing, and the API
    keeps them apart: the first answers "Closed", the second answers nothing.

    `closes` at or before `opens` means the day runs past midnight: a bar open
    17:00-02:00 is one row on the day it opens, not two.
    """
    __tablename__ = "restaurant_hours"

    __table_args__ = (
        # One set of hours per day. Two rows for a Tuesday is not a split
        # shift, it is a bug, and this is where it stops.
        db.UniqueConstraint("restaurant_id", "weekday", name="uq_restaurant_hours_day"),
        db.CheckConstraint("weekday >= 0 AND weekday <= 6", name="ck_restaurant_hours_weekday"),
    ) + (({'schema': SCHEMA},) if environment == "production" else ())

    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(
        db.Integer, db.ForeignKey(add_prefix_for_prod("restaurants.id"), ondelete="CASCADE"),
        nullable=False)
    # 0 is Monday, as in datetime.date.weekday(), so the two never need
    # translating between each other.
    weekday = db.Column(db.Integer, nullable=False)
    opens = db.Column(db.Time, nullable=False)
    closes = db.Column(db.Time, nullable=False)

    restaurant = db.relationship("Restaurant", back_populates="hours")

    @property
    def runs_past_midnight(self):
        return self.closes <= self.opens

    def to_dict(self):
        return {
            "weekday": self.weekday,
            "opens": self.opens.strftime("%H:%M"),
            "closes": self.closes.strftime("%H:%M"),
        }
