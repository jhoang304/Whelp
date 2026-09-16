import os
from flask import Flask, render_template, request, session, redirect
from flask_cors import CORS
from flask_migrate import Migrate
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_login import LoginManager
from .models import db, User
from .api.user_routes import user_routes
from .api.auth_routes import auth_routes
from .api.restaurant_routes import restaurant_routes
from .api.restaurant_image_routes import resImage_routes
from .api.review_routes import review_routes
from .api.image_routes import image_routes
from .seeds import seed_commands
from .config import Config

app = Flask(__name__, static_folder='../react-app/build', static_url_path='/')

# Setup login manager
login = LoginManager(app)
login.login_view = 'auth.unauthorized'


@login.user_loader
def load_user(id):
    return User.query.get(int(id))


# Tell flask about our seed commands
app.cli.add_command(seed_commands)

app.config.from_object(Config)
app.register_blueprint(user_routes, url_prefix='/api/users')
app.register_blueprint(auth_routes, url_prefix='/api/auth')
app.register_blueprint(restaurant_routes, url_prefix='/api/restaurants')
app.register_blueprint(resImage_routes, url_prefix='/api/restaurant-images')
app.register_blueprint(review_routes, url_prefix='/api/reviews')
app.register_blueprint(image_routes, url_prefix='/api/images')
db.init_app(app)
Migrate(app, db)

# Application Security
CORS(app)


# Since we are deploying with Docker and Flask,
# we won't be using a buildpack when we deploy to Heroku.
# Therefore, we need to make sure that in production any
# request made over http is redirected to https.
# Well.........
@app.before_request
def https_redirect():
    if os.environ.get('FLASK_ENV') == 'production':
        if request.headers.get('X-Forwarded-Proto') == 'http':
            url = request.url.replace('http://', 'https://', 1)
            code = 301
            return redirect(url, code=code)


@app.after_request
def inject_csrf_token(response):
    response.set_cookie(
        'csrf_token',
        generate_csrf(),
        secure=True if os.environ.get('FLASK_ENV') == 'production' else False,
        samesite='Strict' if os.environ.get(
            'FLASK_ENV') == 'production' else None,
        httponly=True)
    return response


@app.route("/api/docs")
def api_help():
    """
    Returns all API routes and their doc strings
    """
    acceptable_methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    route_list = { rule.rule: [[ method for method in rule.methods if method in acceptable_methods ],
                    app.view_functions[rule.endpoint].__doc__ ]
                    for rule in app.url_map.iter_rules() if rule.endpoint != 'static' }
    return route_list


def api_not_found():
    """A JSON 404 for API callers, who have no use for index.html."""
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


@app.errorhandler(404)
def not_found(e):
    """
    Where unknown paths actually land: `static_url_path` is '/', so the static
    rule matches first and raises 404 when there is no such file. Serve the
    SPA for a page URL, and JSON for an API one.
    """
    if request.path.startswith('/api/'):
        return api_not_found()
    return app.send_static_file('index.html')
