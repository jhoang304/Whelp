import json
import os
from flask import Flask, make_response, render_template, request, session, redirect
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_login import LoginManager
from werkzeug.exceptions import HTTPException, InternalServerError, RequestEntityTooLarge
from werkzeug.middleware.proxy_fix import ProxyFix
from .models import db, User
from .api.user_routes import user_routes
from .api.auth_routes import auth_routes
from .api.google_routes import google_routes
from .api.password_reset_routes import password_reset_routes
from .api.restaurant_routes import restaurant_routes
from .api.category_routes import category_routes
from .api.amenity_routes import amenity_routes
from .api.restaurant_image_routes import resImage_routes
from .api.review_routes import review_routes
from .api.review_image_routes import review_image_routes
from .api.image_routes import TOO_LARGE_MESSAGE, image_routes
from .cli import check_db
from .seeds import seed_commands
from .config import Config
from .environment import is_production
from .extensions import limiter

app = Flask(__name__, static_folder='../react-app/build', static_url_path='/')

# Setup login manager
login = LoginManager(app)


@login.unauthorized_handler
def unauthorized():
    """
    A signed-out request to a route that needs a user: 401, in the API's own
    errors shape (#126). With a login_view, Flask-Login answered with a 302 to
    an HTML "Redirecting..." page instead -- which a browser follows with the
    same method, so a stale tab's PUT or DELETE ended in a 405 from the GET-only
    page it was sent to -- and flashed "Please log in" into the session cookie
    on every refusal, for an API that never shows one.
    """
    return {'errors': ['Unauthorized']}, 401


@login.user_loader
def load_user(id):
    return db.session.get(User, int(id))


# Tell flask about our seed commands
app.cli.add_command(seed_commands)
app.cli.add_command(check_db)

app.config.from_object(Config)
app.register_blueprint(user_routes, url_prefix='/api/users')
app.register_blueprint(auth_routes, url_prefix='/api/auth')
app.register_blueprint(google_routes, url_prefix='/api/auth/google')
app.register_blueprint(password_reset_routes, url_prefix='/api/auth/password-reset')
app.register_blueprint(restaurant_routes, url_prefix='/api/restaurants')
app.register_blueprint(category_routes, url_prefix='/api/categories')
app.register_blueprint(amenity_routes, url_prefix='/api/amenities')
app.register_blueprint(resImage_routes, url_prefix='/api/restaurant-images')
app.register_blueprint(review_routes, url_prefix='/api/reviews')
app.register_blueprint(review_image_routes, url_prefix='/api/review-images')
app.register_blueprint(image_routes, url_prefix='/api/images')
# Before anything reads an address: the rate limit is keyed on one.
if app.config["TRUSTED_PROXY_HOPS"]:
    hops = app.config["TRUSTED_PROXY_HOPS"]
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=hops, x_proto=hops)

db.init_app(app)
Migrate(app, db)
limiter.init_app(app)

# Since we are deploying with Docker and Flask,
# we won't be using a buildpack when we deploy to Heroku.
# Therefore, we need to make sure that in production any
# request made over http is redirected to https.
# Well.........
@app.before_request
def https_redirect():
    if is_production():
        if request.headers.get('X-Forwarded-Proto') == 'http':
            url = request.url.replace('http://', 'https://', 1)
            code = 301
            return redirect(url, code=code)


@app.before_request
def drop_stale_flashes():
    """
    The "Please log in" messages Flask-Login used to flash on every refusal,
    still in the cookies of anyone refused before #126. Nothing reads them;
    they were parsed on every request and never went away, even after logging
    in. Touching the session only when they are there leaves every other
    response's cookie alone.
    """
    if '_flashes' in session:
        session.pop('_flashes')


@app.before_request
def json_bodies_are_objects():
    """
    Every JSON body the API takes is an object. A list, a string or a number
    reached Flask-WTF's ImmutableMultiDict(...) and crashed it, or a route's
    request.get_json()["name"] -- a 500 for what is a caller's mistake (#111).
    A body that is not JSON at all is left to the route, whose get_json()
    answers it with a 400 of its own.
    """
    if not request.path.startswith('/api/') or not request.is_json:
        return None
    raw = request.get_data(cache=True).strip()
    if not raw:
        return None
    body = request.get_json(silent=True)
    if body is None and raw != b'null':
        return None
    if not isinstance(body, dict):
        return {'errors': ['The request body must be a JSON object.']}, 400
    return None


# Every POST, PUT, PATCH and DELETE must carry the CSRF token in an
# X-CSRFToken header (or a csrf_token form field), checked before the route
# runs. It used to be checked only inside routes that validate a FlaskForm,
# by copying the token out of the request's own cookie -- which a browser
# attaches to a forged request too, so the only defence was that cookie's
# SameSite, and routes with no form (favorites, every delete, set cover)
# were not checked at all (#109). A page on another origin cannot read the
# cookie to fill in the header, nor send a custom header without a CORS
# preflight this app never answers.
CSRFProtect(app)


@app.after_request
def inject_csrf_token(response):
    # Readable by the page, which sends it back as X-CSRFToken (the
    # double-submit pattern): only a script on this origin can read it.
    response.set_cookie(
        'csrf_token',
        generate_csrf(),
        secure=is_production(),
        samesite='Strict' if is_production() else None,
        httponly=False)
    return response


# Headers every response carries. HSTS only in production, where the site
# is https: a browser that has seen it goes straight to https afterwards,
# rather than sending a first request over http for the redirect.
SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    # Nobody frames Whelp: a framed Account settings page is a clickjack.
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
}


@app.after_request
def add_security_headers(response):
    for name, value in SECURITY_HEADERS.items():
        response.headers.setdefault(name, value)
    if is_production():
        response.headers.setdefault(
            'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    return response


ERROR_SHAPE = (
    'Every failing response is {"errors": [message, ...]}: a flat list of '
    'human-readable strings the UI can render as-is. The status code carries '
    'what kind of failure it was -- 400 a bad body, 401 not signed in, 403 not '
    'yours, 404 no such thing, 405 wrong method (with an Allow header), 500 '
    'our fault. That holds for the failures Werkzeug raises before a route '
    'runs, and for the ones no route saw coming.'
)


@app.route("/api/docs")
def api_help():
    """
    Returns the API's error contract, then all routes and their doc strings
    """
    acceptable_methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    route_list = { rule.rule: [[ method for method in rule.methods if method in acceptable_methods ],
                    app.view_functions[rule.endpoint].__doc__ ]
                    for rule in app.url_map.iter_rules() if rule.endpoint != 'static' }
    return {"errors": ERROR_SHAPE, "routes": route_list}


# The rules that answer GET for any URL at all: Flask's static handler (the
# static_url_path is '/') and the SPA catch-all below.
CATCH_ALL_ENDPOINTS = {'static', 'react_root'}


def api_methods_for(path):
    """
    The methods a real API rule accepts for `path`.

    The catch-alls answer GET for every URL, which is what lets a client route
    survive a reload -- but it also means Werkzeug matches them instead of
    raising 405 for an API URL that only exists under another method. Ask the
    map directly, ignoring the rules that match everything.
    """
    adapter = app.url_map.bind(request.host)
    allowed = set()
    for method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'):
        try:
            endpoint, _ = adapter.match(path, method=method)
        except HTTPException:
            continue
        if endpoint not in CATCH_ALL_ENDPOINTS:
            allowed.add(method)
    return allowed


def api_error():
    """
    The API's answer for a URL no API rule wants: 405 when the endpoint exists
    under other methods, so a client is told to change the verb rather than
    hunting a URL that is right there, and 404 otherwise. Either way JSON --
    an API caller has no use for index.html.
    """
    allowed = api_methods_for(request.path)
    if allowed:
        response = make_response({'errors': ['Method not allowed']}, 405)
        response.headers['Allow'] = ', '.join(sorted(allowed))
        return response
    return {'errors': ['Not found']}, 404


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def react_root(path):
    """
    Serves the built React app, so a URL only the client router knows about
    survives a full page load. A path under /api/ that gets this far is a
    caller asking for data, and answering it with the app's HTML (at 200, no
    less) hid every typo and stale endpoint.
    """
    if path.startswith('api/'):
        # api_error: api_not_found() was never defined, and only the static
        # rule matching /api/ GETs first kept this line from being a NameError
        # (#129).
        return api_error()
    return app.send_static_file('index.html')


@app.errorhandler(HTTPException)
def http_exception_to_json(e):
    """
    Werkzeug raises these before any route runs -- a 405, a 413, a body that
    isn't the JSON it claims -- and answers with an HTML page. API callers get
    the documented shape instead, on the error's own response so its headers
    (405's Allow, for one) survive.
    """
    if not request.path.startswith('/api/'):
        return e

    # The SPA's catch-alls take GET on every path, so Werkzeug's 405 for an
    # API path counts them: POST to a path no API rule has was a 405 offering
    # GET, and PUT on a POST-only one offered GET too, itself a 405 there.
    # api_error asks the API's own rules: 404 when none of them has the path,
    # and a 405 whose Allow is what they really take (#129).
    if e.code == 405:
        return api_error()

    response = e.get_response()
    response.data = json.dumps({'errors': [e.description]})
    response.content_type = 'application/json'
    return response


@app.errorhandler(RequestEntityTooLarge)
def request_too_large(e):
    """
    A body past MAX_CONTENT_LENGTH, which is sized for the image upload --
    the only route that takes one that big -- so say it in the upload's terms
    there, rather than "The data value transmitted exceeds the capacity limit."
    """
    if request.path == '/api/images/upload':
        e.description = TOO_LARGE_MESSAGE
    return http_exception_to_json(e)


@app.errorhandler(Exception)
def unexpected_error_to_json(e):
    """
    A bug in a route is still a failure the caller has to read. Flask's HTML
    500 page is not that, and the frontend's parser would fall back to a
    generic message -- so say it in the shape, and log it.
    """
    # Flask's config always holds PROPAGATE_EXCEPTIONS, as None unless it is
    # set, so .get() never fell back to testing/debug: a bug was a JSON 500
    # under pytest and under FLASK_DEBUG, with the traceback swallowed (#129).
    propagate = app.config.get('PROPAGATE_EXCEPTIONS')
    if propagate is None:
        propagate = app.testing or app.debug
    if propagate:
        raise e

    app.logger.exception('Unhandled error on %s %s', request.method, request.path)
    if request.path.startswith('/api/'):
        return {'errors': ['Something went wrong on our end.']}, 500
    return InternalServerError()


@app.errorhandler(404)
def not_found(e):
    """
    Where unknown paths actually land: `static_url_path` is '/', so the static
    rule matches first and raises 404 when there is no such file. Serve the
    SPA for a page URL, and JSON for an API one.
    """
    if request.path.startswith('/api/'):
        return api_error()
    return app.send_static_file('index.html')
