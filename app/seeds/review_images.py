from app.models import db, ReviewImage, environment, SCHEMA

def seed_reviewImages():
    revImage1 = ReviewImage(
        review_id=1, url="https://s3-media0.fl.yelpcdn.com/bphoto/xnhmhaBX9eSwFkFbEJFhGQ/o.jpg"
    )
    revImage2 = ReviewImage(
        review_id=2, url="https://s3-media0.fl.yelpcdn.com/bphoto/92cJIzfezu8DyUOsy4b3RQ/o.jpg"
    )
    revImage3 = ReviewImage(
        review_id=3, url="https://s3-media0.fl.yelpcdn.com/bphoto/A_qiJ5WOd38e2E_XR7qAUg/o.jpg"
    )
    revImage4 = ReviewImage(
        review_id=4, url="https://s3-media0.fl.yelpcdn.com/bphoto/NAoFVEnskpjXHUTuBtiwEg/o.jpg"
    )
    revImage5 = ReviewImage(
        review_id=5, url="https://s3-media0.fl.yelpcdn.com/bphoto/-eZoH4QWgBa1gA3mbjPYEw/o.jpg"
    )
    revImage6 = ReviewImage(
        review_id=6, url="https://s3-media0.fl.yelpcdn.com/bphoto/znB5dCVTF4lh1F_Ezxoe_g/o.jpg"
    )

    db.session.add_all([revImage1, revImage2, revImage3, revImage4, revImage5, revImage6])
    db.session.commit()


def undo_reviewImages():
    if environment == "production":
        db.session.execute(
            f"TRUNCATE table {SCHEMA}.review_images RESTART IDENTITY CASCADE;")
    else:
        db.session.execute("DELETE FROM review_images")

    db.session.commit()
