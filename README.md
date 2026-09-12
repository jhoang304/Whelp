# Whelp
https://whelp-8ru8.onrender.com/

* Whelp is a web application based on the idea of Yelp

## Introduction

Whelp is a platform where users can search for businesses and leave reviews for them. Users can also create their own businesses and add them to the platform. Whelp is a full-stack application built with React, Redux, TypeScript, Flask, SQLAlchemy, and PostgreSQL. Some functionalities include:

* User authentication and authorization
* Creating, reading, updating, and deleting businesses
* Creating, reading, updating, and deleting reviews
* Searching businesses by name, city, state, or description
* User profile pages with an avatar, the reviews a user has written, and the businesses they own
* Business owners can publicly respond to reviews left on their restaurants (one response per review, editable and deletable)
* Photo uploads (restaurant photos and profile pictures) stored in AWS S3, with a paste-a-URL fallback

Future Functionalities:
* Photos attached to individual reviews
* Business hours and amenities editable by the owner

--------------------------------------------------------------------------------------------------------------------------------------

## Technologies
The website uses the following technologies:

### Backend:
* Python
* Flask
* SQLAlchemy
* AWS S3 (boto3) for image storage

### Frontend:
* TypeScript / JavaScript
* React
* Redux

--------------------------------------------------------------------------------------------------------------------------------------

## Launching locally instructions:
Running the backend server:
* From the root directory, copy `.env.example` to `.env` (the defaults use a local SQLite database)
* Run "pipenv install -r requirements.txt" to install dependencies
* Run "pipenv shell" to run the virtual environment
* Run "flask db upgrade" to create a local database
* Run "flask seed all" to populate the database with seed data (6 users, 10 restaurants, 34 dated reviews, and 11 owner responses)
* Run "flask run" to boot up the backend server

Running the frontend server:
* From the root directory, cd into the react-app directory/folder
* Run "npm install" to install dependencies
* Run "npm start" to boot up the frontend server and open a browser tab to the landing page

Log in with the demo account (`demo@aa.io` / `password`) or the "Log in as Demo User" button. The demo user owns Nancy's Hustle and Bacari Silverlake, so you can try responding to reviews there.

### Photo uploads (optional)
Uploads go to an S3 bucket when these variables are set in `.env`:

```
S3_BUCKET=your-bucket-name
S3_KEY=your-access-key-id
S3_SECRET=your-secret-access-key
```

The IAM user needs `s3:PutObject` and `s3:DeleteObject` on the bucket, and objects must be publicly readable (either through a bucket policy or by leaving ACLs enabled; the app retries without an ACL if the bucket has ACLs disabled). After each upload the app checks that the object is publicly readable and rejects the upload with a clear message if it is not. Without these variables the app still works: the photo dialogs accept an image URL instead, and the upload endpoint answers with a clear 503.

### Running the tests
```
pipenv install --dev
pytest
```
The tests in `tests/` run the Flask app against an in-memory SQLite database and cover profiles, owner responses, and the upload endpoint (S3 is mocked).

--------------------------------------------------------------------------------------------------------------------------------------

# Images:

Screenshots are best viewed on the live site linked above. The previous hosted images expired, so they were removed from this README.
