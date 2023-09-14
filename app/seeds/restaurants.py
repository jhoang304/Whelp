from app.models import db, Restaurant, environment, SCHEMA

def seed_restaurants():
    res1 = Restaurant(
        user_id=1, name="Nancy's Hustle", price="$$$", address="2704 Polk St", city="Houston",
        state="TX", zipcode=77003, country="USA", phone_number="(346) 571-7931", website="http://nancyshustle.com",
        description="Nancy's Hustle is a modern bistro on Houston's east side. We like butter, natural wine, cider, and cocktails that pair well with food."
    )
    res2 = Restaurant(
        user_id=2, name="Uchi", price="$$$$", address="904 Westheimer Rd Ste A", city="Houston",
        state="TX", zipcode=77006, country="USA", phone_number="(713) 522-4808", website="http://uchihouston.com",
        description="Uchi, 'house' in Japanese, is founded by James Beard Award winning Chef Tyson Cole. A delicate balance of elevated food and impeccable service, Uchi offers non traditional Japanese cuisine with signature tastings, sushi, and seasonal omakase."
    )
    res3 = Restaurant(
        user_id=3, name="Lua Viet Kitchen", price="$$", address = "1540 W Alabama St Ste 300", city = "Houston",
        state ="TX", zipcode= 77006, country="USA", phone_number = "(346) 227-7047", website="http://www.luavietkitchen.com",
        description="At LVK, we strive to bring elevated Vietnamese cuisine to Houstonians. We believe food should be made fresh using high quality ingredients. We're proud of the many local partnerships with similar vision and purpose. Sure it takes more time to source responsibly. It takes more effort to prepare food without MSG. But our valued guests deserve more than the standard fare. So come dine with us and xin mi (please enjoy)!"
    )
    res4 = Restaurant(
        user_id=1, name="Bacari Silverlake", price="$$", address="3626 Sunset Blvd", city="Los Angeles",
        state="CA", zipcode=90026, country="USA", phone_number="(323) 410-7304", website="https://www.bacarisilverlake.com/",
        description="Bacari Silverlake is a Venetian-inspired small plates restaurant featuring Mediterranean-influenced dishes by Chef Lior Hillel. We are the original restaurant of Kronfli Brothers, a family-owned, growing group of restaurants in the Los Angeles area. Offering a rotating curation of small-production wines, unique cocktails, and eclectic beers from around the world, we are also known for our one-of-a-kind 90-minute open bar special."
    )
    res5 = Restaurant(
        user_id=2, name="Gramercy Tavern", price="$$$$", address="42 E 20th St", city="New York",
        state="NY", zipcode=10003, country="USA", phone_number="(212) 477-0777", website="https://www.gramercytavern.com/",
        description="One of America's most beloved restaurants, Gramercy Tavern has welcomed guests to enjoy its contemporary American cuisine, warm hospitality, and unparalleled service in New York City for over two decades."
    )
    res6 = Restaurant(
        user_id=3, name="Girl & The Goat", price="$$$", address="809 W Randolph", city="Chicago",
        state="IL", zipcode=60607, country="USA", phone_number="(312) 492-6262", website="https://www.girlandthegoat.com/",
        description="As one of the first restaurants on Chicago’s famed Restaurant Row in the West Loop, Stephanie Izard’s Girl & the Goat began in 2010 with a goal of serving bold, global flavors to our local community (and visitors!)."
    )
    res7 = Restaurant(
        user_id=4, name="Au Cheval", price="$$", address="800 W Randolph St", city="Chicago",
        state="IL", zipcode=60607, country="USA", phone_number="(312) 929-4580", website="https://auchevaldiner.com/chicago/",
        description="A diner-style bar and restaurant with a passion for eggs, Au Cheval elevates traditional diner fare. Guests can indulge in dishes ranging from chopped chicken liver and roasted bone marrow, to traditional sandwiches, egg-focused entrees, and the signature cheeseburger."
    )
    res8 = Restaurant(
        user_id=4, name="Sixty Vines", price="$$", address="500 Crescent Ct Ste 160", city="Dallas",
        state="TX", zipcode=75201, country="USA", phone_number="(214) 814-8463", website="https://www.sixtyvines.com/",
        description="Welcome to Sixty Vines, where great food, wine, and company come together to create unforgettable moments! As 'the winemaker's restaurant,' we deliver wine country inspired-cuisine paired perfectly with 60 wines on our sustainable tap system."
    )
    res9 = Restaurant(
        user_id=5, name="Yardbird", price="$$", address="3355 Las Vegas Blvd S", city="Las Vegas",
        state="NV", zipcode=89109, country="USA", phone_number="(702) 297-6541", website="https://runchickenrun.com/las-vegas/",
        description="A modern take on comfort food means shared plates, craft cocktails, critically acclaimed fried chicken, and an ideal place for brunch or dinner."
    )
    res10 = Restaurant(
        user_id=5, name="Versailles", price="$$", address="3555 SW 8th St", city="Miami",
        state="FL", zipcode=33135, country="USA", phone_number="(305) 444-0240", website="https://www.versaillesrestaurant.com/",
        description="The Most Famous Cuban Restaurant in the World"
    )


    db.session.add_all([res1, res2, res3, res4, res5, res6, res7, res8, res9, res10])
    db.session.commit()

def undo_restaurants():
    if environment == "production":
        db.session.execute(
            f"TRUNCATE table {SCHEMA}.restaurants RESTART IDENTITY CASCADE;")
    else:
        db.session.execute("DELETE FROM restaurants")

    db.session.commit()
