from app.models import db, Restaurant, environment, SCHEMA

def seed_restaurants():
    res1 = Restaurant(
        user_id=1, name="Nancy's Hustle", price="$$$", address="2704 Polk St", city="Houston",
        state="TX", zipcode=77003, country="USA", phone_number="(346) 571-7931", website="http://nancyshustle.com", description="Nancy's Hustle is a modern bistro on Houston's east side. We like butter, natural wine, cider, and cocktails that pair well with food."
    )
    res2 = Restaurant(
        user_id=2, name="Uchi", price="$$$$", address="904 Westheimer Rd Ste A", city="Houston",
        state="TX", zipcode=77006, country="USA", phone_number="(713) 522-4808", website="http://uchihouston.com", description="Uchi, 'house' in Japanese, is founded by James Beard Award winning Chef Tyson Cole. A delicate balance of elevated food and impeccable service, Uchi offers non traditional Japanese cuisine with signature tastings, sushi, and seasonal omakase."
    )
    res3 = Restaurant(
        user_id=3, name="Lua Viet Kitchen", price="$$", address = "1540 W Alabama St Ste 300", city = "Houston",
        state ="TX", zipcode= 77006, country="USA", phone_number = "(346) 227-7047", website="http://www.luavietkitchen.com", description="At LVK, we strive to bring elevated Vietnamese cuisine to Houstonians. We believe food should be made fresh using high quality ingredients. We're proud of the many local partnerships with similar vision and purpose. Sure it takes more time to source responsibly. It takes more effort to prepare food without MSG. But our valued guests deserve more than the standard fare. So come dine with us and xin mi (please enjoy)!"
    )


    db.session.add_all([res1, res2, res3])
    db.session.commit()

def undo_restaurants():
    if environment == "production":
        db.session.execute(
            f"TRUNCATE table {SCHEMA}.restaurants RESTART IDENTITY CASCADE;")
    else:
        db.session.execute("DELETE FROM restaurants")

    db.session.commit()
