from app.models import db, RestaurantImage, environment, SCHEMA

def seed_restaurantImages():
    res1_image1 = RestaurantImage(
        restaurant_id=1, url="https://s3-media0.fl.yelpcdn.com/bphoto/cF1Jtk2Am_dCNLXk0ZJ_fg/348s.jpg", preview=True
    )
    res1_image2 = RestaurantImage(
        restaurant_id=1, url="https://s3-media0.fl.yelpcdn.com/bphoto/84gpaauptA1MBBcxhyzRVg/348s.jpg", preview=False
    )
    res1_image3 = RestaurantImage(
        restaurant_id=1, url="https://s3-media0.fl.yelpcdn.com/bphoto/1XAoSwY5hzOzNklyH-i-2A/348s.jpg", preview=False
    )
    res1_image4 = RestaurantImage(
        restaurant_id=1, url="https://s3-media0.fl.yelpcdn.com/bphoto/F-E7O_Mnx7rtb1deZa6Q4Q/348s.jpg", preview=False
    )
    res2_image1 = RestaurantImage(
        restaurant_id=2, url="https://s3-media0.fl.yelpcdn.com/bphoto/pim-nUIk2308EHZCMBp5wg/348s.jpg", preview=True
    )
    res2_image2 = RestaurantImage(
        restaurant_id=2, url="https://s3-media0.fl.yelpcdn.com/bphoto/hzbjKbAGaYiRn9rw8ZyJ6w/348s.jpg", preview=False
    )
    res2_image3 = RestaurantImage(
        restaurant_id=2, url="https://s3-media0.fl.yelpcdn.com/bphoto/PDFU_Zl566ONROWMGtQEJA/348s.jpg", preview=False
    )
    res2_image4 = RestaurantImage(
        restaurant_id=2, url="https://s3-media0.fl.yelpcdn.com/bphoto/pYG2YZAFbWK0wGZsyyg_dA/348s.jpg", preview=False
    )
    res3_image1 = RestaurantImage(
        restaurant_id=3, url="https://s3-media0.fl.yelpcdn.com/bphoto/C4Ca7WI-i7PUhDVCapX9Cg/348s.jpg", preview=True
    )
    res3_image2 = RestaurantImage(
        restaurant_id=3, url="https://s3-media0.fl.yelpcdn.com/bphoto/STru1UGZvZ9JlV8ZljSJNg/348s.jpg", preview=False
    )
    res3_image3 = RestaurantImage(
        restaurant_id=3, url="https://s3-media0.fl.yelpcdn.com/bphoto/rjDIjk_es-25_k93_9IGcA/348s.jpg", preview=False
    )
    res3_image4 = RestaurantImage(
        restaurant_id=3, url="https://s3-media0.fl.yelpcdn.com/bphoto/S7fgrf38twxsKIHmrR1FhQ/348s.jpg", preview=False
    )


    db.session.add_all([res1_image1, res1_image2, res1_image3, res1_image4, res2_image1, res2_image2, res2_image3, res2_image4, res3_image1, res3_image2, res3_image3, res3_image4])
    db.session.commit()


def undo_restaurantImages():
    if environment == "production":
        db.session.execute(
            f"TRUNCATE table {SCHEMA}.restaurants RESTART IDENTITY CASCADE;")
    else:
        db.session.execute("DELETE FROM restaurant_images")

    db.session.commit()
