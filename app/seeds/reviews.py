from app.models import db, Review, environment, SCHEMA

def seed_reviews():
    review1 = Review(
        user_id=2, restaurant_id=1, review="Whew baby!!! Where do I start?! This place gets 6 stars!!! Ok! I came here for my birthday and they did not disappoint!", rating=5
    )
    review2 = Review(
        user_id=3, restaurant_id=1, review="Overall extremely overpriced for mediocre food. I was so excited about coming for the first time but I was not impressed. Oh and can't forget the automatic charge of 20% gratuity on a party of 2 is absolutely absurd.", rating=3
    )
    review3 = Review(
        user_id=1, restaurant_id=2, review="A great sushi spot that is a bit pricey but well worth the spend for a once in a while special meal.", rating=5
    )
    review4 = Review(
        user_id=3, restaurant_id=2, review="Overall, I had a good experience and I would like to try more dishes and just come back for my favorites!", rating=4
    )
    review5 = Review(
        user_id=1, restaurant_id=3, review="It lives UP to the hype. Environment is casual and clean, and the service is swift and kind.", rating=5
    )
    review6 = Review(
        user_id=2, restaurant_id=3, review="Delicious vietnamese food spot. I got the pho and it was super good. Very hearty broth and very flavorful. I definitely want to come back here.", rating=4
    )


    db.session.add_all([review1, review2, review3, review4, review5, review6])
    db.session.commit()


def undo_reviews():
    if environment == "production":
        db.session.execute(
            f"TRUNCATE table {SCHEMA}.reviews RESTART IDENTITY CASCADE;")
    else:
        db.session.execute("DELETE FROM reviews")

    db.session.commit()
