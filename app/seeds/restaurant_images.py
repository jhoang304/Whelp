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
    res1_image5 = RestaurantImage(
        restaurant_id=1, url="https://s3-media0.fl.yelpcdn.com/bphoto/gkqb8LqKr8bdcMn_cGux7g/348s.jpg", preview=False
    )
    res1_image6 = RestaurantImage(
        restaurant_id=1, url="https://s3-media0.fl.yelpcdn.com/bphoto/IxNLxzAEKm1L4cWRx2suCg/348s.jpg", preview=False
    )
    res1_image7 = RestaurantImage(
        restaurant_id=1, url="https://s3-media0.fl.yelpcdn.com/bphoto/kWbG1n7rfYz-XHwUZoHxQw/348s.jpg", preview=False
    )
    res1_image8 = RestaurantImage(
        restaurant_id=1, url="https://s3-media0.fl.yelpcdn.com/bphoto/fYrziUaBb8NztuinwcA8ew/348s.jpg", preview=False
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
    res2_image5 = RestaurantImage(
        restaurant_id=2, url="https://s3-media0.fl.yelpcdn.com/bphoto/Egp9WsmVp1WNdGK_PZcqaw/348s.jpg", preview=False
    )
    res2_image6 = RestaurantImage(
        restaurant_id=2, url="https://s3-media0.fl.yelpcdn.com/bphoto/2wKcrtBImGb8jvz60XZj5g/348s.jpg", preview=False
    )
    res2_image7 = RestaurantImage(
        restaurant_id=2, url="https://s3-media0.fl.yelpcdn.com/bphoto/NtDdAMyPDpidGcGzogDhDQ/348s.jpg", preview=False
    )
    res2_image8 = RestaurantImage(
        restaurant_id=2, url="https://s3-media0.fl.yelpcdn.com/bphoto/um1dEucLzU8lpyFzwXD5Ag/348s.jpg", preview=False
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
    res3_image5 = RestaurantImage(
        restaurant_id=3, url="https://s3-media0.fl.yelpcdn.com/bphoto/dVzq4fwiCF8TdL_eW8Utnw/348s.jpg", preview=False
    )
    res3_image6 = RestaurantImage(
        restaurant_id=3, url="https://s3-media0.fl.yelpcdn.com/bphoto/C4Ca7WI-i7PUhDVCapX9Cg/348s.jpg", preview=False
    )
    res3_image7 = RestaurantImage(
        restaurant_id=3, url="https://s3-media0.fl.yelpcdn.com/bphoto/Sapj7dkuu4YQllNdJqG_Gg/348s.jpg", preview=False
    )
    res3_image8 = RestaurantImage(
        restaurant_id=3, url="https://s3-media0.fl.yelpcdn.com/bphoto/qx3u2CAXdKFq8vaasexHgw/348s.jpg", preview=False
    )
    res4_image1 = RestaurantImage(
        restaurant_id=4, url="https://s3-media0.fl.yelpcdn.com/bphoto/U00R-a50WZv8YW9u5-nJjw/348s.jpg", preview=True
    )
    res4_image2 = RestaurantImage(
        restaurant_id=4, url="https://s3-media0.fl.yelpcdn.com/bphoto/F_XYLKQv7rf8XQ_HR3JMLA/348s.jpg", preview=False
    )
    res4_image3 = RestaurantImage(
        restaurant_id=4, url="https://s3-media0.fl.yelpcdn.com/bphoto/rYqoE4hKPWzxKOJ6wZwxfg/348s.jpg", preview=False
    )
    res4_image4 = RestaurantImage(
        restaurant_id=4, url="https://s3-media0.fl.yelpcdn.com/bphoto/u0T6fGS05t25F-y1S6bAVA/348s.jpg", preview=False
    )
    res4_image5 = RestaurantImage(
        restaurant_id=4, url="https://s3-media0.fl.yelpcdn.com/bphoto/k7Aa0VaIsdh4jehfH5XLMQ/348s.jpg", preview=False
    )
    res4_image6 = RestaurantImage(
        restaurant_id=4, url="https://s3-media0.fl.yelpcdn.com/bphoto/4oRgbFO1diFmJsAW8tFx6Q/348s.jpg", preview=False
    )
    res4_image7 = RestaurantImage(
        restaurant_id=4, url="https://s3-media0.fl.yelpcdn.com/bphoto/9vhQZoXcKAohi_gYgySfUQ/348s.jpg", preview=False
    )
    res4_image8 = RestaurantImage(
        restaurant_id=4, url="https://s3-media0.fl.yelpcdn.com/bphoto/Y2snZp20qesF5mMYZ5qlUg/348s.jpg", preview=False
    )
    res5_image1 = RestaurantImage(
        restaurant_id=5, url="https://s3-media0.fl.yelpcdn.com/bphoto/f14WAmWETi0cu2f6rUBj-Q/348s.jpg", preview=True
    )
    res5_image2 = RestaurantImage(
        restaurant_id=5, url="https://s3-media0.fl.yelpcdn.com/bphoto/nVeROcJIBh2tWtbmBJonow/348s.jpg", preview=False
    )
    res5_image3 = RestaurantImage(
        restaurant_id=5, url="https://s3-media0.fl.yelpcdn.com/bphoto/UZLXDg3KH9dFA64i_dhecg/348s.jpg", preview=False
    )
    res5_image4 = RestaurantImage(
        restaurant_id=5, url="https://s3-media0.fl.yelpcdn.com/bphoto/NRxdUUNAVgRvxLBRtyRSmA/348s.jpg", preview=False
    )
    res5_image5 = RestaurantImage(
        restaurant_id=5, url="https://s3-media0.fl.yelpcdn.com/bphoto/4reZLdR-yXLCnNI6qnIVcA/348s.jpg", preview=False
    )
    res5_image6 = RestaurantImage(
        restaurant_id=5, url="https://s3-media0.fl.yelpcdn.com/bphoto/VZA5XdH4ZsEhNRDHSAjYjw/348s.jpg", preview=False
    )
    res5_image7 = RestaurantImage(
        restaurant_id=5, url="https://s3-media0.fl.yelpcdn.com/bphoto/-4CXgZ1AMsu-FMjq1-kUYA/348s.jpg", preview=False
    )
    res5_image8 = RestaurantImage(
        restaurant_id=5, url="https://s3-media0.fl.yelpcdn.com/bphoto/8z7BG4kdgqGHD0HtBIcLuw/348s.jpg", preview=False
    )
    res6_image1 = RestaurantImage(
        restaurant_id=6, url="https://s3-media0.fl.yelpcdn.com/bphoto/ya6gjD4BPlxe7AKMj_5WsA/348s.jpg", preview=True
    )
    res6_image2 = RestaurantImage(
        restaurant_id=6, url="https://s3-media0.fl.yelpcdn.com/bphoto/msZRwFUVyHjBebs9Wl4BXA/348s.jpg", preview=False
    )
    res6_image3 = RestaurantImage(
        restaurant_id=6, url="https://s3-media0.fl.yelpcdn.com/bphoto/_6UjBIJ6lJQ0BENSp7DFOA/348s.jpg", preview=False
    )
    res6_image4 = RestaurantImage(
        restaurant_id=6, url="https://s3-media0.fl.yelpcdn.com/bphoto/Za7R9pSBDukvtGXlEwjCcg/348s.jpg", preview=False
    )
    res6_image5 = RestaurantImage(
        restaurant_id=6, url="https://s3-media0.fl.yelpcdn.com/bphoto/zsy2dOkgbauR4fDNazZ7kw/348s.jpg", preview=False
    )
    res6_image6 = RestaurantImage(
        restaurant_id=6, url="https://s3-media0.fl.yelpcdn.com/bphoto/6wKrkaBzj9L3MCfNIBAsFw/348s.jpg", preview=False
    )
    res6_image7 = RestaurantImage(
        restaurant_id=6, url="https://s3-media0.fl.yelpcdn.com/bphoto/l5W3I4FyxpaX5n2YlM4Lfw/348s.jpg", preview=False
    )
    res6_image8 = RestaurantImage(
        restaurant_id=6, url="https://s3-media0.fl.yelpcdn.com/bphoto/tHx6VyAsI3_tDW04yr1sAA/348s.jpg", preview=False
    )
    res7_image1 = RestaurantImage(
        restaurant_id=7, url="https://s3-media0.fl.yelpcdn.com/bphoto/td7RDAytLoNuPMlCQ6IuMw/348s.jpg", preview=True
    )
    res7_image2 = RestaurantImage(
        restaurant_id=7, url="https://s3-media0.fl.yelpcdn.com/bphoto/WVN08s_S1Lsa0GmAMec4uA/348s.jpg", preview=False
    )
    res7_image3 = RestaurantImage(
        restaurant_id=7, url="https://s3-media0.fl.yelpcdn.com/bphoto/GSGpz2PTc4YD7rDzEMIz8Q/348s.jpg", preview=False
    )
    res7_image4 = RestaurantImage(
        restaurant_id=7, url="https://s3-media0.fl.yelpcdn.com/bphoto/B9-b2TewB9RF0jreJYi28w/348s.jpg", preview=False
    )
    res7_image5 = RestaurantImage(
        restaurant_id=7, url="https://s3-media0.fl.yelpcdn.com/bphoto/i0VxRaZxRH-ksizrztT54w/348s.jpg", preview=False
    )
    res7_image6 = RestaurantImage(
        restaurant_id=7, url="https://s3-media0.fl.yelpcdn.com/bphoto/oQCSj0d_yJFNf_tRP9YgNw/348s.jpg", preview=False
    )
    res7_image7 = RestaurantImage(
        restaurant_id=7, url="https://s3-media0.fl.yelpcdn.com/bphoto/l8abcE5iHcOQBp2tQt-MJg/348s.jpg", preview=False
    )
    res7_image8 = RestaurantImage(
        restaurant_id=7, url="https://s3-media0.fl.yelpcdn.com/bphoto/LUj2Hbl0nQ4UWucIM08ZGA/348s.jpg", preview=False
    )
    res8_image1 = RestaurantImage(
        restaurant_id=8, url="https://s3-media0.fl.yelpcdn.com/bphoto/bKKLJKauKJOtBMiIdSuLgw/348s.jpg", preview=True
    )
    res8_image2 = RestaurantImage(
        restaurant_id=8, url="https://s3-media0.fl.yelpcdn.com/bphoto/W_orrQC2nsgaORncwYQXog/348s.jpg", preview=False
    )
    res8_image3 = RestaurantImage(
        restaurant_id=8, url="https://s3-media0.fl.yelpcdn.com/bphoto/BSmCHrbDkcezZgqvA52NOg/348s.jpg", preview=False
    )
    res8_image4 = RestaurantImage(
        restaurant_id=8, url="https://s3-media0.fl.yelpcdn.com/bphoto/3HZLePDQB07Vcz00UUzxvg/348s.jpg", preview=False
    )
    res8_image5 = RestaurantImage(
        restaurant_id=8, url="https://s3-media0.fl.yelpcdn.com/bphoto/1jTzTFDkHvc9pNb64rz6QA/348s.jpg", preview=False
    )
    res8_image6 = RestaurantImage(
        restaurant_id=8, url="https://s3-media0.fl.yelpcdn.com/bphoto/hQZ5V3K-KSadK-8udcSJhA/348s.jpg", preview=False
    )
    res8_image7 = RestaurantImage(
        restaurant_id=8, url="https://s3-media0.fl.yelpcdn.com/bphoto/Pag7tXjALFvGEH9uXkMRXw/348s.jpg", preview=False
    )
    res8_image8 = RestaurantImage(
        restaurant_id=8, url="https://s3-media0.fl.yelpcdn.com/bphoto/NqJ1QD16fmeZNYQPzbt2Cw/348s.jpg", preview=False
    )


    db.session.add_all([res1_image1, res1_image2, res1_image3, res1_image4, res1_image5, res1_image6, res1_image7, res1_image8,
                        res2_image1, res2_image2, res2_image3, res2_image4, res2_image5, res2_image6, res2_image7, res2_image8,
                        res3_image1, res3_image2, res3_image3, res3_image4, res3_image5, res3_image6, res3_image7, res3_image8,
                        res4_image1, res4_image2, res4_image3, res4_image4, res4_image5, res4_image6, res4_image7, res4_image8,
                        res5_image1, res5_image2, res5_image3, res5_image4, res5_image5, res5_image6, res5_image7, res5_image8,
                        res6_image1, res6_image2, res6_image3, res6_image4, res6_image5, res6_image6, res6_image7, res6_image8,
                        res7_image1, res7_image2, res7_image3, res7_image4, res7_image5, res7_image6, res7_image7, res7_image8,
                        res8_image1, res8_image2, res8_image3, res8_image4, res8_image5, res8_image6, res8_image7, res8_image8])
    db.session.commit()


def undo_restaurantImages():
    if environment == "production":
        db.session.execute(
            f"TRUNCATE table {SCHEMA}.restaurants RESTART IDENTITY CASCADE;")
    else:
        db.session.execute("DELETE FROM restaurant_images")

    db.session.commit()
