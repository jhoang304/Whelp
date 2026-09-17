"""
Extensions that routes need and the app factory wires up.

Kept out of app/__init__.py because the blueprints import from here, and
app/__init__.py imports the blueprints.
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Limits are declared on the routes that need them (see auth_routes); there is
# no default limit, so nothing else is throttled.
limiter = Limiter(key_func=get_remote_address)
