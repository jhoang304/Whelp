from flask import Blueprint, jsonify, request, session
from app.models import Restaurant, Review, RestaurantImage

restaurant_routes = Blueprint('restaurants', __name__)


# Get all Restaurants
@restaurant_routes.route('/')
def restaurants():
    restaurants = Restaurant.query.all()
    reviews=Review.query.all()
    restaurant_images= RestaurantImage.query.all()


    for restaurant in restaurants:
      restaurants_reviews = Review.query.filter(
          Review.restaurant_id == restaurant.id).all()
      if len(restaurants_reviews)==0:
        restaurant.aveRating=0
      rating = 0
      review_count = 0
      for review in restaurants_reviews:

        review_count=review_count+1
        rating=rating+review.rating


        aveRating=rating/review_count
        restaurant.aveRating=aveRating


    for restaurant in restaurants:
      restaurant.preview= None
      for image in restaurant_images:
        if image.restaurant_id == restaurant.id and image.preview == True:
          restaurant.preview=image.url

    for restaurant in restaurants:
      restaurant.oneReview= None
      for review in reviews:
        if review.restaurant_id == restaurant.id:
          restaurant.oneReview=review.review


    data={
      "Restaurants":[{
      "id":restaurant.id,
      "user_id": restaurant.user_id,
      "name":restaurant.name,
      "price":restaurant.price,
      "address" : restaurant.address,
      "city" : restaurant.city,
      "state" :restaurant.state,
      "zipcode": restaurant.zipcode,
      "country":restaurant.country,
      "phone_number" : restaurant.phone_number,
      "description" : restaurant.description,
      "website":restaurant.website,
      "avgRating": round(restaurant.aveRating,2),
      "previewImage": restaurant.preview,
      "oneReview":restaurant.oneReview
    } for restaurant in restaurants]}

    return data
