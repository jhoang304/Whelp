"""
Signing in with Google, at /api/auth/google.

Google has checked that an address belongs to the person signing in. Whelp's
own signup never has. So a Google sign-in whose address already has a Whelp
account doesn't open that account: whoever signed up with the address might
not be its owner, and would keep a password into the account the owner went
on to use. The owner logs in with the password instead, and connects Google
from Account settings -- which asks for the password again, so a session
left open on a shared computer can't connect a stranger's Google account.

Every way through Google ends in a redirect: to the page the sign-in started
from, or to the login or settings page with ?google=<what happened>, which
the page turns into a message.
"""
import hmac
import re
import secrets

from flask import Blueprint, current_app, redirect, request, session, url_for
from flask_login import current_user, login_required, login_user
from sqlalchemy.exc import IntegrityError

from app.api import google
from app.api.utils import error_messages
from app.extensions import limiter
from app.forms import ConnectGoogleForm
from app.models import User, db

google_routes = Blueprint('google', __name__)

LOGIN_PAGE = '/login'
SETTINGS_PAGE = '/settings'
# The limits the account columns and the profile form hold to.
USERNAME_MAX = 40
NAME_MAX = 50
URL_MAX = 255
EMAIL_MAX = 255


def come_back_to(path):
    """
    A path inside the app to come back to, or home -- the rule returnTo.ts
    applies to the same value before sending it. "//elsewhere" and
    "/\\elsewhere" are another site, and the login and signup pages would only
    send someone signed in straight on again.
    """
    if not isinstance(path, str) or len(path) > 2000 or not re.match(r"/(?![/\\])", path):
        return '/'
    if re.split(r"[?#]", path)[0] in (LOGIN_PAGE, '/signup'):
        return '/'
    return path


def told(page, code):
    """The page, told what happened: "/login?google=cancelled"."""
    return redirect(f"{page}?google={code}")


def callback_url():
    # Behind Render's proxy, ProxyFix makes this https.
    return url_for('google.callback', _external=True)


@google_routes.route('', methods=['GET'])
def status():
    """
    {"available": whether Google sign-in is offered here, which needs
    GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET; "confirmed": whether whoever is
    signed in has signed in with Google in the last ten minutes -- what a
    passwordless account shows instead of a password, to set one or to delete
    itself}.
    """
    return {
        'available': google.is_configured(),
        'confirmed': bool(current_user.is_authenticated and google.recently_confirmed(current_user)),
    }


def _off_to_google(intent, back):
    """Start a sign-in: keep its one-time values in the session, and answer with Google's page."""
    flow = google.new_flow()
    redirect_uri = callback_url()
    session['google_flow'] = {
        **flow,
        'intent': intent,
        'next': back,
        # The same address has to be sent again with the code.
        'redirect_uri': redirect_uri,
        'user_id': current_user.id if current_user.is_authenticated else None,
    }
    return google.authorization_url(flow, redirect_uri)


@google_routes.route('/start', methods=['GET'])
@limiter.limit("20 per minute")
def start():
    """
    Off to Google: ?intent=login|confirm&next=<a path to come back to>. Visited
    by the browser, not fetched.

    login signs in with Google, making an account if the address has none.
    confirm is someone signed in to an account made with Google showing it's
    theirs, where a password would be asked for; it comes back to settings.
    """
    intent = request.args.get('intent')
    if intent != 'confirm':
        intent = 'login'
    page = LOGIN_PAGE if intent == 'login' else SETTINGS_PAGE
    back = come_back_to(request.args.get('next')) if intent == 'login' else SETTINGS_PAGE

    if not google.is_configured():
        return told(page, 'unavailable')
    if intent == 'login' and current_user.is_authenticated:
        return redirect(back)
    if intent == 'confirm' and not current_user.is_authenticated:
        return redirect(LOGIN_PAGE)
    return redirect(_off_to_google(intent, back))


@google_routes.route('/connect', methods=['POST'])
@login_required
# It checks a password, so it is a place to guess one: the same limit as
# logging in.
@limiter.limit("10 per minute")
def connect():
    """
    Start connecting a Google account to yours: {"password"}. Answers
    {"url"}, Google's page, for the browser to go to; Google sends it back to
    settings.

    The password is asked for though you are signed in, as changing it asks
    for it: a Google account is another way in, and a session left open on a
    shared computer shouldn't be enough to add one.
    """
    user = current_user._get_current_object()
    if user.is_demo:
        return {'errors': ["The demo account can't connect a Google account: everyone shares it."]}, 403
    if user.google_sub is not None:
        return {'errors': ["A Google account is already connected."]}, 400
    if not google.is_configured():
        return {'errors': ["Signing in with Google isn't available right now."]}, 503

    form = ConnectGoogleForm()
    form['csrf_token'].data = request.cookies.get('csrf_token')
    if not form.validate_on_submit():
        return {'errors': error_messages(form.errors)}, 400
    if not user.check_password(form.data['password']):
        return {'errors': ["That password is incorrect."]}, 400
    return {'url': _off_to_google('connect', SETTINGS_PAGE)}


@google_routes.route('', methods=['DELETE'])
@login_required
def disconnect():
    """
    Disconnect Google from your account. Only once it has a password: with
    neither, nothing could sign in to it. Answers your user.
    """
    user = current_user._get_current_object()
    if user.google_sub is None:
        return {'errors': ["No Google account is connected."]}, 400
    if not user.has_password:
        return {'errors': ["Set a password before disconnecting Google, or you'd have no way to log in."]}, 400
    user.google_sub = None
    db.session.commit()
    return user.to_dict()


@google_routes.route('/callback', methods=['GET'])
@limiter.limit("20 per minute")
def callback():
    """
    Where Google sends the browser back, with a code to trade for who the
    person is. Not for calling: it only answers a sign-in this session
    started, once.
    """
    # Taken out whatever happens next: a code is good for one try.
    flow = session.pop('google_flow', None)
    state = request.args.get('state', '')
    if not isinstance(flow, dict) or not hmac.compare_digest(state.encode(), flow['state'].encode()):
        # No sign-in started here, one that already finished, or another
        # tab's: nothing to trust the code for.
        on_settings = isinstance(flow, dict) and flow.get('intent') != 'login'
        return told(SETTINGS_PAGE if on_settings else LOGIN_PAGE, 'expired')

    intent = flow['intent']
    page = LOGIN_PAGE if intent == 'login' else SETTINGS_PAGE
    if request.args.get('error'):
        # access_denied: they chose Cancel at Google.
        return told(page, 'cancelled')
    code = request.args.get('code')
    if not code:
        return told(page, 'failed')
    try:
        claims = google.exchange_code(code, flow['redirect_uri'], flow)
    except google.GoogleError as error:
        current_app.logger.warning("Signing in with Google failed: %s", error)
        return told(page, 'failed')

    if intent == 'login':
        return _sign_in(claims, flow['next'])

    # Connecting and confirming are for whoever started them, still signed in.
    if not current_user.is_authenticated or current_user.id != flow['user_id']:
        return told(SETTINGS_PAGE, 'expired')
    user = current_user._get_current_object()
    if intent == 'connect':
        return _connect(user, claims)
    return _confirm(user, claims)


def _sign_in(claims, back):
    user = User.query.filter_by(google_sub=claims['sub']).first()
    if user is None:
        # Not signed in with Google before: a new account, if the address is
        # Google's to vouch for and nobody here has it yet.
        if not google.email_verified(claims):
            return told(LOGIN_PAGE, 'unverified')
        if User.with_email(claims['email']):
            return told(LOGIN_PAGE, 'account-exists')
        user, problem = _new_account(claims)
        if problem:
            return told(LOGIN_PAGE, problem)
    login_user(user)
    google.confirm(user)
    return redirect(back)


def _connect(user, claims):
    if user.is_demo:
        return told(SETTINGS_PAGE, 'demo')
    if user.google_sub is not None:
        return told(SETTINGS_PAGE, 'already-connected')
    if User.query.filter_by(google_sub=claims['sub']).first():
        return told(SETTINGS_PAGE, 'in-use')
    user.google_sub = claims['sub']
    try:
        db.session.commit()
    except IntegrityError:
        # Connected to another account between the check and here.
        db.session.rollback()
        return told(SETTINGS_PAGE, 'in-use')
    google.confirm(user)
    return told(SETTINGS_PAGE, 'connected')


def _confirm(user, claims):
    if user.google_sub != claims['sub']:
        return told(SETTINGS_PAGE, 'wrong-account')
    google.confirm(user)
    return told(SETTINGS_PAGE, 'confirmed')


def _new_account(claims):
    """
    The account for a first sign-in with Google, and None; or None, and why
    there isn't one. It has no password: Google is the way in until its owner
    sets one.
    """
    email = claims['email'].strip().lower()
    if len(email) > EMAIL_MAX:
        return None, 'failed'
    first = (claims.get('given_name') or claims.get('name') or email.split('@')[0]).strip()
    picture = claims.get('picture')

    for _ in range(3):
        user = User(
            username=_free_username(email),
            email=email,
            first_name=first[:NAME_MAX],
            # Not everyone gives Google a family name.
            last_name=(claims.get('family_name') or '').strip()[:NAME_MAX],
            profile_image_url=picture if isinstance(picture, str) and len(picture) <= URL_MAX else None,
            google_sub=claims['sub'],
        )
        db.session.add(user)
        try:
            db.session.commit()
            return user, None
        except IntegrityError:
            # Something taken between the checks and the commit: another tab
            # finishing the same sign-in, a signup with the address, or the
            # name. Find out which.
            db.session.rollback()
            already = User.query.filter_by(google_sub=claims['sub']).first()
            if already:
                return already, None
            if User.with_email(email):
                return None, 'account-exists'
            # The name, then: try another.
    return None, 'failed'


def _free_username(email):
    """
    A username nobody has, from the address: "jane.doe@gmail.com" is
    jane.doe, or jane.doe2 if that's taken. They can change it in Edit
    profile.
    """
    base = re.sub(r"[^A-Za-z0-9._-]", "", email.split('@')[0])[:USERNAME_MAX] or 'user'
    if not User.username_taken(base):
        return base
    for number in range(2, 100):
        candidate = f"{base[:USERNAME_MAX - len(str(number))]}{number}"
        if not User.username_taken(candidate):
            return candidate
    return f"{base[:USERNAME_MAX - 7]}-{secrets.token_hex(3)}"
