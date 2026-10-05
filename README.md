# Whelp

[![CI](https://github.com/jhoang304/Whelp/actions/workflows/ci.yml/badge.svg)](https://github.com/jhoang304/Whelp/actions/workflows/ci.yml)

https://whelp-8ru8.onrender.com/

* Whelp is a web application based on the idea of Yelp

## Introduction

Whelp is a platform where users can search for businesses and leave reviews for them. Users can also create their own businesses and add them to the platform. Whelp is a full-stack application built with React, Redux, TypeScript, Flask, SQLAlchemy, and PostgreSQL. Some functionalities include:

* User authentication and authorization, with a shared demo account
* Creating, reading, updating, and deleting businesses, with their cuisines, amenities and opening hours. "Open until 9:30 PM" is worked out in the restaurant's own time zone, not the server's or the reader's
* Creating, reading, updating, and deleting reviews, with up to ten photos each, sortable by newest, highest or lowest rated
* Business owners can publicly respond to reviews left on their restaurants (one response per review, editable and deletable)
* Searching businesses by name, cuisine, city, state, or description
* Filtering the listing and the search by cuisine, price, minimum rating and city, and sorting by rating, review count or newest. The filters live in the URL, so a filtered page can be shared and reloaded
* Saving restaurants to a private list, shown on your own profile and nobody else's
* User profile pages with an avatar, the reviews a user has written, and the businesses they own
* Signing up and logging in with Google, or connecting Google to an account you already have
* Resetting a forgotten password with a link sent by email
* Account settings: change your password, connect or disconnect Google, or delete your account. Your reviews stay, shown as by "Deleted user", so the restaurants keep their ratings
* Photo uploads (restaurant, review and profile photos) stored in AWS S3, with a paste-a-URL fallback
* Keyboard and screen-reader support: dialogs that manage focus and close on Escape, labelled fields, visible focus, and motion that stops for anyone who has asked their system for less
* Layouts for phones and tablets as well as desktops

--------------------------------------------------------------------------------------------------------------------------------------

## Technologies
The website uses the following technologies:

### Backend:
* Python 3.11
* Flask, with Flask-Login, Flask-WTF and Flask-Limiter
* SQLAlchemy, with Alembic migrations (Flask-Migrate)
* PostgreSQL in production, SQLite locally
* AWS S3 (boto3) for image storage
* pytest

### Frontend:
* TypeScript
* React 18
* Redux
* Jest and Testing Library

CI runs both test suites and a production build on every pull request (GitHub Actions).

--------------------------------------------------------------------------------------------------------------------------------------

## Launching locally instructions:
Running the backend server:
* From the root directory, copy `.env.example` to `.env` (the defaults use a local SQLite database)
* Put a `SECRET_KEY` in it. The app refuses to boot without one; generate yours with `python -c "import secrets; print(secrets.token_hex(32))"`
* Use Python 3.11 (pinned in `.python-version`) and Node 22 (pinned in `.node-version`; the build runs on Node 18 or later, the tests need 20 or later)
* Run "pipenv install --dev" to install the dependencies the `Pipfile` lists, including the test tools. The deployed service and CI install the same pinned versions from `requirements.txt`
* Run "pipenv shell" to run the virtual environment
* Run "flask db upgrade" to create a local database
* Run "flask seed all" to populate the database with seed data (6 users, 10 restaurants, 34 dated reviews, and 11 owner responses). It only seeds an empty database, so it is safe to run again; use "flask seed all --reset" to wipe everything and reseed
* Run "flask run" to boot up the backend server

Running the frontend server:
* From the root directory, cd into the react-app directory/folder
* Run "npm install" to install dependencies
* Run "npm start" to boot up the frontend's development server (Vite), then open http://localhost:3000. It sends `/api` requests on to the Flask server on port 5000, so run "flask run" alongside it

### Deploying

Environment variables the deployed service needs:

| Variable | Required | What it does |
|---|---|---|
| `SECRET_KEY` | yes | Signs the session cookie and CSRF tokens. Boot fails without it. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`, and use a different value from your local one |
| `DATABASE_URL` | yes | Postgres connection string. A `postgres://` prefix is rewritten to `postgresql://` for SQLAlchemy |
| `APP_ENV` | yes | Set to `production` on the service itself, not in a committed file — the flask CLI reads `.flaskenv`, so a value there would reach the deployed build commands. Addresses `SCHEMA`, forces https, sends HSTS, and marks the session cookie Secure (it is SameSite=Lax everywhere). `FLASK_ENV` is still read as a fallback, since Flask removed it in 2.3 |
| `SCHEMA` | yes | The Postgres schema this app owns |
| `S3_BUCKET`, `S3_KEY`, `S3_SECRET` | no | Photo uploads. Without them the photo dialogs fall back to pasting an image URL |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Signing in with Google (below). Without them no Google button is shown |
| `RESEND_API_KEY`, `MAIL_FROM`, `PUBLIC_URL` | no | Resetting a forgotten password by email (below). Without all three, production offers no reset |
| `RATELIMIT_STORAGE_URI` | no | Where the login/signup rate limit is counted. The default is in-process, so each worker gets its own allowance. Pointing it at Redis makes the limit mean one thing across workers, and needs the client too: install `flask-limiter[redis]` |
| `TRUSTED_PROXY_HOPS` | no | How many reverse proxies stand in front of the app, so the real client address can be read from `X-Forwarded-For`. Defaults to 1 in production and 0 elsewhere. Leave it at 0 where nothing proxies: trusting that header without a proxy lets a caller spoof an address and walk around the rate limit |
| `SQLALCHEMY_ECHO` | no | `1` logs every SQL statement. Development only, and ignored in production |

The Python version, 3.11.9, is pinned in `.python-version`, which Render reads.

On Render, the build and start commands are:

```
npm install --prefix react-app && npm run build --prefix react-app && pip install -r requirements.txt && pip install psycopg2 && flask db upgrade && flask seed all && flask seed demo-reset
```

```
gunicorn app:app
```

If a deploy fails to reach the database, put `flask check-db` in the build command ahead of `flask db upgrade`. It prints which user, host and database the service actually received, the password's length and an eight-character fingerprint of it -- never the password itself -- and then either connects or reports the driver's one-line refusal. Running it locally against the same connection string and comparing fingerprints is what tells you whether the service holds the value you think it does.

Keep `flask db upgrade && flask seed all` in the build command. Migrations run on every deploy, and the seed step now does nothing once the database has data, so a redeploy no longer erases what users have added. Run `flask seed all --reset` only when you really want a fresh copy of the demo data.

Because `flask seed all` skips a database that already has data, a database seeded before cuisines, amenities and opening hours existed has the vocabularies but none of it attached to the demo restaurants. `flask seed backfill` fills that in: it touches only restaurants named in the demo seed, only fills what is empty -- anything an owner has set is kept -- and skips a name that matches more than one restaurant. It only reports what it would do until you add `--apply`. Run it once: `flask seed backfill --apply` from a shell on the service, or, where there is no shell (Render's free instances have none), add `&& flask seed backfill --apply` to the end of the build command for a single deploy and then take it back out. Left in, it runs on every deploy, and it cannot tell a restaurant with no hours from one whose owner cleared them.

Log in with the demo account (`demo@aa.io` / `password`) or the "Log in as Demo User" button. The demo user owns Nancy's Hustle and Bacari Silverlake, so you can try responding to reviews there.

Everyone who tries the site shares the demo account, so the API keeps it from what can't be undone or would take other people's work with it: changing its password, deleting itself, deleting or renaming its two restaurants, changing its profile, and removing a photo someone else added to one of its restaurants. Everything else it may change. `flask seed demo-reset` puts the demo back as seeded -- its profile, and each of its restaurants' details, cuisines, amenities, hours, photos and cover -- and recreates either restaurant if it is gone. It only adds and restores, never removes, and a second run finds nothing to do, so it belongs at the end of the build command (above): every deploy repairs the demo. `flask seed demo-reset --dry-run` reports what it would put back without writing anything.

### API reference

`GET /api/docs` lists every route with the methods it accepts and its docstring, which says what it takes and returns. It opens with the error contract, which holds for every route: a failure answers `{"errors": [message, ...]}`, a flat list of strings a UI can show as-is, and the status code says what kind of failure it was. Lists are paginated with `page` and `per_page` (at most 50) and answer `{"items", "page", "per_page", "total"}`.

### Photo uploads (optional)
Uploads go to an S3 bucket when these variables are set in `.env`:

```
S3_BUCKET=your-bucket-name
S3_KEY=your-access-key-id
S3_SECRET=your-secret-access-key
```

Uploads are stored under `uploads/<user id>/<random>.<ext>`, and that key is recorded on the row it is attached to. Deletes act on the recorded key, never on the url in the row: a url is whatever a caller typed, so deriving a key from one made typing somebody else's url authority to delete their image. A row with no key -- a hot-linked image, or a url naming an object the caller did not upload -- is never deleted from the bucket. Objects uploaded before this are only cleaned up if the migration could match them unambiguously; the rest stay, which costs storage rather than somebody's photo.

The IAM user needs `s3:PutObject` and `s3:DeleteObject` on the bucket, and objects must be publicly readable (either through a bucket policy or by leaving ACLs enabled; the app retries without an ACL if the bucket has ACLs disabled). After each upload the app checks that the object is publicly readable and rejects the upload with a clear message if it is not. Without these variables the app still works: the photo dialogs accept an image URL instead, and the upload endpoint answers with a clear 503.

### Signing in with Google (optional)

With an OAuth client from Google Cloud Console, the login and signup pages offer "Continue with Google", and Account settings can connect a Google account to an existing one. To set one up:

1. In [Google Cloud Console](https://console.cloud.google.com/), make a project. Under **Google Auth Platform**, set up the consent screen with an app name and a support email. The app asks only for `openid`, `email` and `profile`.
2. Under **Clients**, create a **Web application** client. Add each place Google may send people back to as an authorized redirect URI:
   - `http://localhost:5000/api/auth/google/callback` for `flask run`
   - `http://localhost:3000/api/auth/google/callback` for `npm start`
   - `https://<your-site>/api/auth/google/callback` for the deployed service
3. Put the client's ID and secret in `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and in the deployed service's environment.
4. While the consent screen's publishing status is **Testing**, only the test users listed on it can sign in. Publish the app to let anyone.

How it behaves:

- **First sign-in:** this makes an account with no password. Its username comes from the email address, and its name and picture come from Google. The owner can set a password later, in Account settings.
- **An address that already has an account:** Google sign-in doesn't open it. Whelp never checked that whoever signed up with that address owns it, so Google's word that the address is yours doesn't hand the account over. Log in with the password and connect Google from Account settings instead. Connecting asks for the password again, as changing it does.
- **Accounts with no password:** they confirm with Google where others would give a password. Signing in with Google counts for ten minutes, and is what lets such an account set a password or delete itself.
- **How it talks to Google:** this is OpenID Connect's authorization code flow with PKCE, a one-time state and a nonce, in `app/api/google.py`. It uses the standard library and nothing else.

### Resetting a forgotten password (optional)

"Forgot your password?" on the login page emails a link for choosing a new password. The email goes through [Resend](https://resend.com), over its HTTPS API: Render's free web services block the SMTP ports, so SMTP wouldn't get out.

1. Sign up at Resend. Under **Domains**, add a domain you own and the DNS records it shows you. Until a domain is verified, Resend only emails your own address.
2. Under **API Keys**, create a key with sending access.
3. On the deployed service, set:
   - `RESEND_API_KEY` to that key.
   - `MAIL_FROM` to an address on that domain, such as `Whelp <noreply@your-domain.com>`. It needn't be a real mailbox.
   - `PUBLIC_URL` to the site's address, such as `https://your-site.onrender.com`. The link is built from it rather than from the request, because a request's `Host` header is whatever its sender wrote.

**Locally,** without `RESEND_API_KEY`, the email is written to the flask log instead, link and all, so the whole flow can be tried without sending anything.

How it behaves:

- **The same answer for every address.** Asking always gets the same reply, whether or not the address has an account. The email is sent after the response, so how long it takes doesn't give anything away either. The demo account never gets one.
- **Asking is rate-limited.** One address gets three emails an hour, and one caller can ask ten times a minute.
- **The link** carries a token signed with `SECRET_KEY`. It lasts an hour, and works once: its signature covers the account's password hash, so any new password ends it, including the one it sets. Nothing is stored in the database.
- **The token stays out of logs.** It sits after the `#`, which a browser never sends, so it isn't in the server's access log or any `Referer`. The page takes it out of the address bar as soon as it's read.
- **Using the link** sets the new password and signs you in. An account made with Google can use it to set its first password.

### Running the tests

Backend, from the repo root:
```
pipenv install --dev
pytest
```

Frontend, from `react-app/`:
```
npm ci
npx tsc
npx vitest run
```

The Flask tests run the app against an in-memory SQLite database with S3 mocked, and cover the routes, permissions, error shape, form rules and query counts. Every pull request runs both suites, the production build, and a dependency audit of each side -- `pip-audit` for the backend and `npm audit --omit=dev` for the frontend -- either of which fails the run: see `.github/workflows/ci.yml`.

### Checking a layout change on small screens

The stylesheets share two breakpoints, 900px (tablet) and 600px (phone), documented at the top of `react-app/src/index.css`. A change to layout is not done until it has been looked at in the browser's device toolbar (Chrome/Edge: F12, then Ctrl+Shift+M) at **375px** and **768px**:

- [ ] Nothing scrolls sideways. In the console, `document.documentElement.scrollWidth === innerWidth` should be `true`.
- [ ] The nav fits: the logo and profile button share the first row, and the search box gets a row of its own.
- [ ] Restaurant cards (`/restaurants`, search results) show the photo above the text at 375px and beside it at 768px.
- [ ] The restaurant page is one column at 375px, with the contact box under the description and ahead of the reviews. At 768px it is two columns.
- [ ] Every modal (Add Restaurant, Edit Restaurant, Add Photo, See all photos, the delete confirmation) fits inside the window and scrolls inside itself, with nothing cut off at the top or bottom.
- [ ] The review forms fit, and their photo pickers wrap rather than overflow.
