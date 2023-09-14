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
        review="I'm normally not big on fusion, not because of the concept, but because so many places fail at getting it right. Decidedly NOT the case for Uchi. Every dish I've had there was successful in honoring the nature of the ingredient.",
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
        review="Green salad was not fresh with stale corn chips and very spicy dressing. When ask to replace it they brought green leaves with drops of olive oil - called it salad.",
        rating=2
    )
    review11 = Review(
        user_id=1, restaurant_id=6,
        review="I've been wanting to try Girl & the Goat for the longest time (like 5 or 6 years) and finally tried it when one of my friends was in town. We had such a wonderful dinner and our server Lucy was amazing.",
        rating=4
    )
    review12 = Review(
        user_id=2, restaurant_id=6,
        review="Truly delicious. Definitely some of the best food we ate while spending a long weekend in Chicago. We ordered one thing from each category (small plate/sharing model) and most everything was amazing. ",
        rating=5
    )
    review13 = Review(
        user_id=1, restaurant_id=7,
        review="Best cheeseburger on Earth!!! This is worth the hype! Wait as long as you must to experience. You want this!",
        rating=5
    )
    review14 = Review(
        user_id=2, restaurant_id=7,
        review="Food was fantastic very shake-shack-ish. Service was from rude teens who and left much to be desired except from one young lady bagging to go orders she was very helpful.",
        rating=4
    )
    review15 = Review(
        user_id=3, restaurant_id=7,
        review="Food is delicious, service is mediocre at best. Music was at ear bleed volume, maybe I'm just old.",
        rating=4
    )
    review16 = Review(
        user_id=5, restaurant_id=7,
        review="Au Cheval has a long line outside for one simple reason: they're still the best burger in Chicago and the word is out.",
        rating=4
    )
    review17 = Review(
        user_id=1, restaurant_id=8,
        review="The drinks were good, especially the frosés. Margherita pizza, shishito peppers, and crispy zucchinis were the best things we ordered. I wasn't really overly impressed by anything though.",
        rating=3
    )
    review18 = Review(
        user_id=2, restaurant_id=8,
        review="Maybe I had an isolated experience but the food I've had from here was below subpar. I had the pork pasta and a Caesar salad and neither of them had flavor. Also kinda expensive for the portion size.",
        rating=2
    )
    review19 = Review(
        user_id=3, restaurant_id=8,
        review="My new favorite spot! First off the Crescent Court is just beautiful. It's a little oasis in the middle of Dallas.",
        rating=4
    )
    review20 = Review(
        user_id=5, restaurant_id=8,
        review="Stopped here for lunch on a recent business trip to Dallas. The dining space felt well lit with natural light. I had the Fig and Prosciutto pizza and my friend had the Margherita pizza. I'd definitely return.",
        rating=4
    )
    review21 = Review(
        user_id=1, restaurant_id=9,
        review="Servers are excellent and knowledgeable, manager is very nice and we're especially kind to us after a bad situation had occurred earlier. Would definitely recommend food was delicious.",
        rating=5
    )
    review22 = Review(
        user_id=2, restaurant_id=9,
        review="We had reservations, still had to wait 20 minutes. Then they came split the check when we had over 12 people.  Made it way more difficult.  I had Blacked salmon which was 4oz and did not feel us up at all.",
        rating=2
    )
    review23 = Review(
        user_id=3, restaurant_id=9,
        review="Went here on the recommendation of many. Disappointed on the entrees unfortunately.. I chose the rotisserie chicken based on the recommendation of the server but unfortunately this was saturated in grease.",
        rating=3
    )
    review24 = Review(
        user_id=4, restaurant_id=9,
        review="Extremely overpriced-$33 for fried chicken that tastes exactly like Popeyes. They automatically added an 18% gratuity had to ask them to change that due to customer service.",
        rating=1
    )
    review25 = Review(
        user_id=1, restaurant_id=10,
        review="Maybe we ordered the wrong things but the seafood rice didnt hit as we thought it would, the flavors were oily and salty, feeling heavy.",
        rating=3
    )
    review26 = Review(
        user_id=2, restaurant_id=10,
        review="I think there are better Cuban restaurants in Miami which is why I give 3 stars. My friends visiting had this on their list - I can see why, it is a heavy tourist spot and the wait was 1.5 hours.",
        rating=3
    )
    review27 = Review(
        user_id=3, restaurant_id=10,
        review="The food was satisfactory, although it didn't match up to the finest Cuban cuisine I've experienced in Miami.",
        rating=4
    )
    review28 = Review(
        user_id=4, restaurant_id=10,
        review="Worth the wait! Typically a wait to be seated and they don't take reservations. Plan to just get here early to put your name in.",
        rating=4
    )
    review30 = Review(
        user_id=4, restaurant_id=1,
        review="The nancy's canes were decent, nothing too crazy, I was expecting the best thing since sliced bread but I was honestly underwhelmed. 3/5",
        rating=3
    )
    review31 = Review(
        user_id=5, restaurant_id=1,
        review="Nancy's Hustle has an innovative and unique menu. Everything sounds delicious. I really wanted to like this place as much as most other reviews do.",
        rating=4
    )
    review32 = Review(
        user_id=4, restaurant_id=2,
        review="Honestly, I think this place has let itself go compared to what it used to be. I did the Omakase last weekend and for what we spent, it was pretty mediocre.",
        rating=3
    )
    review33 = Review(
        user_id=5, restaurant_id=2,
        review="What a yummy meal on my first ever visit to Uchi! I have been meaning to check this place out for a while, and was happy to try it out after receiving a gift certificate from my friends.",
        rating=4
    )
    review34 = Review(
        user_id=4, restaurant_id=3,
        review="Service was great and so was the ambiance with lots of natural lighting and super clean. Food was good. Not great but not bad. I had the bun thit nuong and my bf had the bo luc lac.",
        rating=3
    )
    review35 = Review(
        user_id=5, restaurant_id=3,
        review="I ordered egg rolls and wonton soup here based on popularity from UberEats. Egg rolls were missing major flavors like pepper, onions, mushrooms. Wonton soup was worst than the pre-packaged from Safeway.",
        rating=2
    )




    db.session.add_all([review1, review2, review3, review4, review5, review6, review7, review8, review9, review10, review11, review12, review13, review14, review15, review16,
                        review17, review18, review19, review20, review21, review22, review23, review24, review25, review26, review27, review28, review30, review31, review32, review33,
                        review34, review35])
    db.session.commit()


def undo_reviews():
    if environment == "production":
        db.session.execute(
            f"TRUNCATE table {SCHEMA}.reviews RESTART IDENTITY CASCADE;")
    else:
        db.session.execute("DELETE FROM reviews")

    db.session.commit()
