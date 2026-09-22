import json
import os
from flask import Flask, make_response, render_template, request, session, redirect
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_login import LoginManager
from werkzeug.exceptions import HTTPException, InternalServerError
from werkzeug.middleware.proxy_fix import ProxyFix
from .models import db, User
from .api.user_routes import user_routes
from .api.auth_routes import auth_routes
from .api.restaurant_routes import restaurant_routes
from .api.category_routes import category_routes
from .api.restaurant_image_routes import resImage_routes
from .api.review_routes import review_routes
from .api.image_routes import image_routes
from .cli import check_db
from .seeds import seed_commands
from .config import Config
from .environment import is_production
from .extensions import limiter

app = Flask(__name__, static_folder='../react-app/build', static_url_path='/')

# Setup login manager
login = LoginManager(app)
login.login_view = 'auth.unauthorized'


@login.user_loader
def load_user(id):
    return db.session.get(User, int(id))


# Tell flask about our seed commands
app.cli.add_command(seed_commands)
app.cli.add_command(check_db)

app.config.from_object(Config)
app.register_blueprint(user_routes, url_prefix='/api/users')
app.register_blueprint(auth_routes, url_prefix='/api/auth')
app.register_blueprint(restaurant_routes, url_prefix='/api/restaurants')
app.register_blueprint(category_routes, url_prefix='/api/categories')
app.register_blueprint(resImage_routes, url_prefix='/api/restaurant-images')
app.register_blueprint(review_routes, url_prefix='/api/reviews')
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


@app.after_request
def inject_csrf_token(response):
    response.set_cookie(
        'csrf_token',
        generate_csrf(),
        secure=is_production(),
        samesite='Strict' if is_production() else None,
        httponly=True)
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
        return api_not_found()
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

    response = e.get_response()
    response.data = json.dumps({'errors': [e.description]})
    response.content_type = 'application/json'
    return response


@app.errorhandler(Exception)
def unexpected_error_to_json(e):
    """
    A bug in a route is still a failure the caller has to read. Flask's HTML
    500 page is not that, and the frontend's parser would fall back to a
    generic message -- so say it in the shape, and log it.
    """
    if app.config.get('PROPAGATE_EXCEPTIONS', app.testing or app.debug):
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
