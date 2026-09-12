from datetime import timedelta

from sqlalchemy.sql import text

from app.models import db, Review, ReviewResponse, environment, SCHEMA


# (reviewer user_id, restaurant_id, response text). The responding user is
# always the owner of that restaurant, looked up from the review itself so the
# seed stays correct even if review ids shift.
RESPONSES = [
    (2, 1, "Thank you so much for celebrating your birthday with us! We're thrilled the night lived up to the occasion and hope to see you again soon."),
    (3, 1, "We're sorry the meal didn't feel worth it. Our service charge is noted on the menu and website, but we understand the frustration. Please reach out to us directly so we can make it right."),
    (4, 1, "Thanks for giving the Nancy's Cakes a try. We're always tinkering with the menu and appreciate the honest feedback."),
    (3, 2, "Honoring the ingredient is exactly what we aim for. Thank you for noticing, and we hope you'll join us for the seasonal omakase."),
    (3, 5, "We're disappointed to hear about the salad, that is not the standard we hold ourselves to. Our manager would love to speak with you; please email us and we'll take care of your next visit."),
    (1, 7, "Best on Earth might be a stretch, but we'll take it! Thanks for waiting in line with us."),
    (2, 8, "We're sorry the pork pasta and Caesar missed the mark. Both recipes have since been reworked, and we'd love a second chance to change your mind."),
    (2, 9, "Thank you for the feedback. Long waits with a reservation and split checks for large parties are things we're actively working on. We hope you'll give us another shot."),
    (4, 9, "We hear you on the price and the automatic gratuity for large parties. We've updated our menu to call it out more clearly and appreciate you flagging it."),
    (2, 10, "Miami has wonderful Cuban food and we're honored to be on your friends' list. The wait can be long on weekends, so try a weekday lunch next time!"),
    (5, 3, "Delivery orders never taste quite the same as dining in, but that's no excuse for missing flavors. Please come see us in person and the first round of egg rolls is on us."),
]


def seed_reviewResponses():
    responses = []
    for reviewer_id, restaurant_id, text_body in RESPONSES:
        review = Review.query.filter(
            Review.user_id == reviewer_id,
            Review.restaurant_id == restaurant_id
        ).first()
        if not review or not review.restaurant:
            continue
        # owners usually reply a few days after the review is posted
        replied_at = review.createdAt + timedelta(days=2 + (review.id % 4), hours=review.id % 12) if review.createdAt else None
        responses.append(ReviewResponse(
            review_id=review.id,
            user_id=review.restaurant.user_id,
            response=text_body,
            createdAt=replied_at,
            updatedAt=replied_at,
        ))

    db.session.add_all(responses)
    db.session.commit()


def undo_reviewResponses():
    if environment == "production":
        db.session.execute(
            text(f"TRUNCATE table {SCHEMA}.review_responses RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text("DELETE FROM review_responses"))

    db.session.commit()
