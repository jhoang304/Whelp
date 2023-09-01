from app.models import db, Review, environment, SCHEMA

def seed_reviews():
    review1 = Review(
        user_id=2, restaurant_id=1,
        review="Whew baby!!! Where do I start?! This place gets 6 stars!!! Ok! I came here for my birthday and they did not disappoint!",
        rating=5
    )
    review2 = Review(
        user_id=3, restaurant_id=1,
        review="Overall extremely overpriced for mediocre food. I was so excited about coming for the first time but I was not impressed. Oh and can't forget the automatic charge of 20% gratuity on a party of 2 is absolutely absurd.",
        rating=3
    )
    review3 = Review(
        user_id=1, restaurant_id=2,
        review="My recent dining experience at Uchi left me utterly amazed and craving for more. From start to finish, the journey through their sushi offerings was a true gastronomic delight.",
        rating=5
    )
    review4 = Review(
        user_id=3, restaurant_id=2,
        review="I'm normally not big on fusion, not because of the concept, but because so many places fail at getting it right. Decidedly NOT the case for Uchi. Every dish I've had there was successful in honoring the nature of the ingredient and how it is traditionally enjoyed with pairing of new flavors which enhance that tradition.",
        rating=4
    )
    review5 = Review(
        user_id=1, restaurant_id=3,
        review="It lives UP to the hype. Environment is casual and clean, and the service is swift and kind.",
        rating=5
    )
    review6 = Review(
        user_id=2, restaurant_id=3,
        review="Delicious vietnamese food spot. I got the pho and it was super good. Very hearty broth and very flavorful. I definitely want to come back here.",
        rating=4
    )
    review7 = Review(
        user_id=2, restaurant_id=4,
        review="I love this place! I've been here a few times and I've never been disappointed. The food is delicious and the service is great. I love the atmosphere and the decor. I highly recommend this place!",
        rating=5
    )
    review8 = Review(
        user_id=3, restaurant_id=4,
        review="OMG, let me tell you about this amazing place I discovered in Silverlake called Bacari! It's like a foodie's dream come true!",
        rating=5
    )
    review9 = Review(
        user_id=1, restaurant_id=5,
        review="Highly recommend!!! The food is delicious. Some highlights include: the seafood tower, the steak tartare, and the burger. The service was wonderful and attentive, and I was given free cavier on my seafood tower.",
        rating=5
    )
    review10 = Review(
        user_id=3, restaurant_id=5,
        review="Green salad was not fresh with stale corn chips and very spicy dressing. When ask to replace it they brought green leaves with drops of olive oil - called it salad. Wine by glass choice is very poor -one bottle of sauvignon blanc and that's it",
        rating=2
    )
    review11 = Review(
        user_id=1, restaurant_id=6,
        review="I've been wanting to try Girl & the Goat for the longest time (like 5 or 6 years) and finally tried it when one of my friends was in town. We had such a wonderful dinner and our server Lucy was amazing. The ambiance is very nice, the lights dim down for dinner and it's a perfect spot for a date night or somewhere to take out of town guests.",
        rating=4
    )
    review12 = Review(
        user_id=2, restaurant_id=6,
        review="Truly delicious. Definitely some of the best food we ate while spending a long weekend in Chicago. We ordered one thing from each category (small plate/sharing model) and most everything was amazing. ",
        rating=5
    )


    db.session.add_all([review1, review2, review3, review4, review5, review6, review7, review8, review9, review10, review11, review12])
    db.session.commit()


def undo_reviews():
    if environment == "production":
        db.session.execute(
            f"TRUNCATE table {SCHEMA}.reviews RESTART IDENTITY CASCADE;")
    else:
        db.session.execute("DELETE FROM reviews")

    db.session.commit()
