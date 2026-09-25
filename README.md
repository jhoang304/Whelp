# Whelp

[![CI](https://github.com/jhoang304/Whelp/actions/workflows/ci.yml/badge.svg)](https://github.com/jhoang304/Whelp/actions/workflows/ci.yml)

https://whelp-8ru8.onrender.com/

* Whelp is a web application based on the idea of Yelp

## Introduction

Whelp is a platform where users can search for businesses and leave reviews for them. Users can also create their own businesses and add them to the platform. Whelp is a full-stack application built with React, Redux, TypeScript, Flask, SQLAlchemy, and PostgreSQL. Some functionalities include:

* User authentication and authorization
* Creating, reading, updating, and deleting businesses
* Creating, reading, updating, and deleting reviews
* Searching businesses by name, cuisine, city, state, or description
* Filtering the listing and the search by cuisine, price, minimum rating and city, and sorting by rating, review count or newest -- the filters live in the URL, so a filtered page can be shared and reloaded
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
* Put a `SECRET_KEY` in it. The app refuses to boot without one; generate yours with `python -c "import secrets; print(secrets.token_hex(32))"`
* Run "pipenv install -r requirements.txt" to install dependencies
* Run "pipenv shell" to run the virtual environment
* Run "flask db upgrade" to create a local database
* Run "flask seed all" to populate the database with seed data (6 users, 10 restaurants, 34 dated reviews, and 11 owner responses). It only seeds an empty database, so it is safe to run again; use "flask seed all --reset" to wipe everything and reseed
* Run "flask run" to boot up the backend server

Running the frontend server:
* From the root directory, cd into the react-app directory/folder
* Run "npm install" to install dependencies
* Run "npm start" to boot up the frontend server and open a browser tab to the landing page

### Deploying

Environment variables the deployed service needs:

| Variable | Required | What it does |
|---|---|---|
| `SECRET_KEY` | yes | Signs the session cookie and CSRF tokens. Boot fails without it. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`, and use a different value from your local one |
| `DATABASE_URL` | yes | Postgres connection string. A `postgres://` prefix is rewritten to `postgresql://` for SQLAlchemy |
| `APP_ENV` | yes | Set to `production` on the service itself, not in a committed file — the flask CLI reads `.flaskenv`, so a value there would reach the deployed build commands. Addresses `SCHEMA`, forces https, and marks the session cookie Secure and SameSite=Strict. `FLASK_ENV` is still read as a fallback, since Flask removed it in 2.3 |
| `SCHEMA` | yes | The Postgres schema this app owns |
| `S3_BUCKET`, `S3_KEY`, `S3_SECRET` | no | Photo uploads. Without them the photo dialogs fall back to pasting an image URL |
| `RATELIMIT_STORAGE_URI` | no | Where the login/signup rate limit is counted. The default is in-process, so each worker gets its own allowance. Pointing it at Redis makes the limit mean one thing across workers, and needs the client too: install `flask-limiter[redis]` |
| `TRUSTED_PROXY_HOPS` | no | How many reverse proxies stand in front of the app, so the real client address can be read from `X-Forwarded-For`. Defaults to 1 in production and 0 elsewhere. Leave it at 0 where nothing proxies: trusting that header without a proxy lets a caller spoof an address and walk around the rate limit |
| `SQLALCHEMY_ECHO` | no | `1` logs every SQL statement. Development only, and ignored in production |

The Python version is pinned in `.python-version`.

If a deploy fails to reach the database, put `flask check-db` in the build command ahead of `flask db upgrade`. It prints which user, host and database the service actually received, the password's length and an eight-character fingerprint of it -- never the password itself -- and then either connects or reports the driver's one-line refusal. Running it locally against the same connection string and comparing fingerprints is what tells you whether the service holds the value you think it does.

Keep `flask db upgrade && flask seed all` in the build command. Migrations run on every deploy, and the seed step now does nothing once the database has data, so a redeploy no longer erases what users have added. Run `flask seed all --reset` only when you really want a fresh copy of the demo data.

Because `flask seed all` skips a database that already has data, a database seeded before cuisines, amenities and opening hours existed has the vocabularies but none of it attached to the demo restaurants. `flask seed backfill` fills that in: it touches only restaurants named in the demo seed, only fills what is empty -- anything an owner has set is kept -- and skips a name that matches more than one restaurant. It only reports what it would do until you add `--apply`. Run it once, by hand, from the Render shell; it is not a build step, because it cannot tell a restaurant with no hours from one whose owner cleared them.

Log in with the demo account (`demo@aa.io` / `password`) or the "Log in as Demo User" button. The demo user owns Nancy's Hustle and Bacari Silverlake, so you can try responding to reviews there.

### Photo uploads (optional)
Uploads go to an S3 bucket when these variables are set in `.env`:

```
S3_BUCKET=your-bucket-name
S3_KEY=your-access-key-id
S3_SECRET=your-secret-access-key
```

Uploads are stored under `uploads/<user id>/<random>.<ext>`, and that key is recorded on the row it is attached to. Deletes act on the recorded key, never on the url in the row: a url is whatever a caller typed, so deriving a key from one made typing somebody else's url authority to delete their image. A row with no key -- a hot-linked image, or a url naming an object the caller did not upload -- is never deleted from the bucket. Objects uploaded before this are only cleaned up if the migration could match them unambiguously; the rest stay, which costs storage rather than somebody's photo.

The IAM user needs `s3:PutObject` and `s3:DeleteObject` on the bucket, and objects must be publicly readable (either through a bucket policy or by leaving ACLs enabled; the app retries without an ACL if the bucket has ACLs disabled). After each upload the app checks that the object is publicly readable and rejects the upload with a clear message if it is not. Without these variables the app still works: the photo dialogs accept an image URL instead, and the upload endpoint answers with a clear 503.

### Running the tests

Backend, from the repo root:
```
pipenv install --dev
pytest
```

Frontend, from `react-app/`:
```
npm ci
npx tsc --noEmit
npm test -- --watchAll=false
```

The Flask tests run the app against an in-memory SQLite database with S3 mocked, and cover the routes, permissions, error shape, form rules and query counts. Every pull request runs both suites, plus the production build and an advisory dependency audit: see `.github/workflows/ci.yml`.

### Checking a layout change on small screens

The stylesheets share two breakpoints, 900px (tablet) and 600px (phone), documented at the top of `react-app/src/index.css`. A change to layout is not done until it has been looked at in the browser's device toolbar (Chrome/Edge: F12, then Ctrl+Shift+M) at **375px** and **768px**:

- [ ] Nothing scrolls sideways. In the console, `document.documentElement.scrollWidth === innerWidth` should be `true`.
- [ ] The nav fits: the logo and profile button share the first row, and the search box gets a row of its own.
- [ ] Restaurant cards (`/restaurants`, search results) show the photo above the text at 375px and beside it at 768px.
- [ ] The restaurant page is one column at 375px, with the contact box under the description and ahead of the reviews. At 768px it is two columns.
- [ ] Every modal (Add Restaurant, Edit Restaurant, Add Photo, See all photos, the delete confirmation) fits inside the window and scrolls inside itself, with nothing cut off at the top or bottom.
- [ ] The review forms fit, and their photo pickers wrap rather than overflow.

--------------------------------------------------------------------------------------------------------------------------------------

# Images:

Screenshots are best viewed on the live site linked above. The previous hosted images expired, so they were removed from this README.
