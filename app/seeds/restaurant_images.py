from app.models import db, RestaurantImage, environment, SCHEMA
from sqlalchemy.sql import text

# Each seeded restaurant's photos, filed by its place in RESTAURANTS (1 is
# Nancy's Hustle), the cover first. All of them hot-linked: none has an
# s3_key, so none is ever deleted from a bucket.
PHOTOS = {
    1: [
        "https://s3-media0.fl.yelpcdn.com/bphoto/cF1Jtk2Am_dCNLXk0ZJ_fg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/84gpaauptA1MBBcxhyzRVg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/1XAoSwY5hzOzNklyH-i-2A/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/F-E7O_Mnx7rtb1deZa6Q4Q/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/gkqb8LqKr8bdcMn_cGux7g/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/IxNLxzAEKm1L4cWRx2suCg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/kWbG1n7rfYz-XHwUZoHxQw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/fYrziUaBb8NztuinwcA8ew/348s.jpg",
    ],
    2: [
        "https://s3-media0.fl.yelpcdn.com/bphoto/pim-nUIk2308EHZCMBp5wg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/hzbjKbAGaYiRn9rw8ZyJ6w/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/PDFU_Zl566ONROWMGtQEJA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/pYG2YZAFbWK0wGZsyyg_dA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/Egp9WsmVp1WNdGK_PZcqaw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/2wKcrtBImGb8jvz60XZj5g/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/NtDdAMyPDpidGcGzogDhDQ/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/um1dEucLzU8lpyFzwXD5Ag/348s.jpg",
    ],
    3: [
        "https://s3-media0.fl.yelpcdn.com/bphoto/C4Ca7WI-i7PUhDVCapX9Cg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/STru1UGZvZ9JlV8ZljSJNg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/rjDIjk_es-25_k93_9IGcA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/S7fgrf38twxsKIHmrR1FhQ/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/dVzq4fwiCF8TdL_eW8Utnw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/C4Ca7WI-i7PUhDVCapX9Cg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/Sapj7dkuu4YQllNdJqG_Gg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/qx3u2CAXdKFq8vaasexHgw/348s.jpg",
    ],
    4: [
        "https://s3-media0.fl.yelpcdn.com/bphoto/U00R-a50WZv8YW9u5-nJjw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/F_XYLKQv7rf8XQ_HR3JMLA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/rYqoE4hKPWzxKOJ6wZwxfg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/u0T6fGS05t25F-y1S6bAVA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/k7Aa0VaIsdh4jehfH5XLMQ/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/4oRgbFO1diFmJsAW8tFx6Q/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/9vhQZoXcKAohi_gYgySfUQ/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/Y2snZp20qesF5mMYZ5qlUg/348s.jpg",
    ],
    5: [
        "https://s3-media0.fl.yelpcdn.com/bphoto/f14WAmWETi0cu2f6rUBj-Q/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/nVeROcJIBh2tWtbmBJonow/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/UZLXDg3KH9dFA64i_dhecg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/NRxdUUNAVgRvxLBRtyRSmA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/4reZLdR-yXLCnNI6qnIVcA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/VZA5XdH4ZsEhNRDHSAjYjw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/-4CXgZ1AMsu-FMjq1-kUYA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/8z7BG4kdgqGHD0HtBIcLuw/348s.jpg",
    ],
    6: [
        "https://s3-media0.fl.yelpcdn.com/bphoto/ya6gjD4BPlxe7AKMj_5WsA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/msZRwFUVyHjBebs9Wl4BXA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/_6UjBIJ6lJQ0BENSp7DFOA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/Za7R9pSBDukvtGXlEwjCcg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/zsy2dOkgbauR4fDNazZ7kw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/6wKrkaBzj9L3MCfNIBAsFw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/l5W3I4FyxpaX5n2YlM4Lfw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/tHx6VyAsI3_tDW04yr1sAA/348s.jpg",
    ],
    7: [
        "https://s3-media0.fl.yelpcdn.com/bphoto/td7RDAytLoNuPMlCQ6IuMw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/WVN08s_S1Lsa0GmAMec4uA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/GSGpz2PTc4YD7rDzEMIz8Q/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/B9-b2TewB9RF0jreJYi28w/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/i0VxRaZxRH-ksizrztT54w/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/oQCSj0d_yJFNf_tRP9YgNw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/l8abcE5iHcOQBp2tQt-MJg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/LUj2Hbl0nQ4UWucIM08ZGA/348s.jpg",
    ],
    8: [
        "https://s3-media0.fl.yelpcdn.com/bphoto/bKKLJKauKJOtBMiIdSuLgw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/W_orrQC2nsgaORncwYQXog/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/BSmCHrbDkcezZgqvA52NOg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/3HZLePDQB07Vcz00UUzxvg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/1jTzTFDkHvc9pNb64rz6QA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/hQZ5V3K-KSadK-8udcSJhA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/Pag7tXjALFvGEH9uXkMRXw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/NqJ1QD16fmeZNYQPzbt2Cw/348s.jpg",
    ],
    9: [
        "https://s3-media0.fl.yelpcdn.com/bphoto/xYJaanpF3Dl1OovhmpqAYw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/7BcH3pDde3hQRKtFbwpWVw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/FsLaE3tbUiFKiGoqLQkuGA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/lqEyr7y8EtZJizj6l_gEGg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/CWFe7a1HuwUzEdyhb0Ge4A/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/k6tLqREqjeluCf18gdblaA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/TDyWK0o2diSxInx9V0RLfg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/9GYi9eWf2-DuXz1i77DMKA/348s.jpg",
    ],
    10: [
        "https://s3-media0.fl.yelpcdn.com/bphoto/VaSpiR7NnuAZbHpOCKfBlg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/31OwFshqcpCYOBVqRnU4WA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/B5ZRPCuqTHk_mHWa0-IIew/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/lqVKHMhDSTIQJY1iUVkOMA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/y9q0eDLr_04o79UmJtuyeg/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/uu-VwCZja_bC5-z6xPH-Hw/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/6mCPc4xD2pErE5B1LN0nfA/348s.jpg",
        "https://s3-media0.fl.yelpcdn.com/bphoto/6VjmttNnOK_o-69BT7bWLQ/348s.jpg",
    ],
}


def seed_restaurantImages():
    db.session.add_all([
        RestaurantImage(restaurant_id=restaurant_id, url=url, preview=index == 0)
        for restaurant_id, urls in PHOTOS.items()
        for index, url in enumerate(urls)
    ])
    db.session.commit()


def undo_restaurantImages():
    if environment == "production":
        db.session.execute(
            text(f"TRUNCATE table {SCHEMA}.restaurant_images RESTART IDENTITY CASCADE;"))
    else:
        db.session.execute(text("DELETE FROM restaurant_images"))

    db.session.commit()
