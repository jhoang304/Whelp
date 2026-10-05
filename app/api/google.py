"""
Talking to Google, for signing in with it: OpenID Connect's authorization
code flow, with PKCE.

The browser is sent to Google carrying a one-time state, nonce and PKCE
challenge, which the session keeps; Google sends it back to the callback
with a code; and the server trades the code -- with the client secret and
the PKCE verifier -- for an ID token, which says who the person is.

No library, because the standard library covers all three steps. The ID
token's signature isn't checked, and needn't be: the token comes straight
from Google's token endpoint over TLS, which OpenID Connect accepts in place
of the signature (Core 1.0, 3.1.3.7, step 6). Everything else the spec asks
is checked: who issued it, who it is for, that it hasn't expired, and that
it carries this sign-in's nonce.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import current_app, session

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
# Google's ID tokens name their issuer either way.
ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
# Clocks differ: a token this far past its expiry still counts.
LEEWAY_SECONDS = 60
# How long a sign-in with Google stands in for the password a passwordless
# account doesn't have, to set one or to delete the account.
CONFIRMATION_SECONDS = 10 * 60


class GoogleError(Exception):
    """Google didn't say who this is: unreachable, refused, or an answer that fails a check."""


def is_configured():
    config = current_app.config
    return bool(config.get("GOOGLE_CLIENT_ID") and config.get("GOOGLE_CLIENT_SECRET"))


def new_flow():
    """The one-time values a sign-in carries: {"state", "nonce", "verifier"}."""
    return {
        "state": secrets.token_urlsafe(32),
        "nonce": secrets.token_urlsafe(32),
        # 86 characters: PKCE wants 43 to 128.
        "verifier": secrets.token_urlsafe(64),
    }


def challenge(verifier):
    """PKCE's S256 challenge: what Google keeps, to check the verifier against later."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def authorization_url(flow, redirect_uri):
    """Google's page, asking who the person is on this sign-in's behalf."""
    return AUTHORIZE_URL + "?" + urlencode({
        "client_id": current_app.config["GOOGLE_CLIENT_ID"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": flow["state"],
        "nonce": flow["nonce"],
        "code_challenge": challenge(flow["verifier"]),
        "code_challenge_method": "S256",
        # Someone signed in to two Google accounts picks one, rather than
        # getting whichever they used last.
        "prompt": "select_account",
    })


def request_tokens(fields):
    """POST to the token endpoint and return its JSON: the one place this calls Google."""
    request = Request(TOKEN_URL, data=urlencode(fields).encode("ascii"), method="POST",
                      headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=10) as response:
            return json.load(response)
    except (URLError, OSError, ValueError) as error:
        # URLError covers a refusal (an HTTPError) as well as no answer.
        raise GoogleError(f"the token request failed: {error}") from error


def exchange_code(code, redirect_uri, flow):
    """Who the person is, from the code Google sent back: the ID token's claims, checked."""
    answer = request_tokens({
        "code": code,
        "client_id": current_app.config["GOOGLE_CLIENT_ID"],
        "client_secret": current_app.config["GOOGLE_CLIENT_SECRET"],
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
        "code_verifier": flow["verifier"],
    })
    id_token = answer.get("id_token") if isinstance(answer, dict) else None
    if not isinstance(id_token, str):
        raise GoogleError("the answer had no ID token")
    return checked_claims(id_token, flow["nonce"])


def checked_claims(id_token, nonce, now=None):
    """The token's claims, once each check OpenID Connect asks for has passed."""
    try:
        payload = id_token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (IndexError, ValueError) as error:
        raise GoogleError("the ID token couldn't be read") from error
    if not isinstance(claims, dict):
        raise GoogleError("the ID token couldn't be read")

    client_id = current_app.config["GOOGLE_CLIENT_ID"]
    audience = claims.get("aud")
    audiences = audience if isinstance(audience, list) else [audience]
    expires = claims.get("exp")
    now = time.time() if now is None else now

    if claims.get("iss") not in ISSUERS:
        raise GoogleError("the ID token wasn't issued by Google")
    if client_id not in audiences or (len(audiences) > 1 and claims.get("azp") != client_id):
        raise GoogleError("the ID token was issued to another app")
    if not isinstance(expires, (int, float)) or expires + LEEWAY_SECONDS < now:
        raise GoogleError("the ID token has expired")
    if not isinstance(claims.get("nonce"), str) or not hmac.compare_digest(
            claims["nonce"].encode(), nonce.encode()):
        raise GoogleError("the ID token belongs to another sign-in")
    if not isinstance(claims.get("sub"), str) or not claims["sub"]:
        raise GoogleError("the ID token doesn't say which account")
    if not isinstance(claims.get("email"), str) or "@" not in claims["email"]:
        raise GoogleError("the ID token has no email address")
    return claims


def email_verified(claims):
    """Whether Google has checked the address belongs to the account. Older tokens say "true"."""
    return claims.get("email_verified") in (True, "true")


def confirm(user):
    """Note that this session's user has just shown, through Google, that the account is theirs."""
    session["google_confirmed"] = {"user_id": user.id, "at": time.time()}


def recently_confirmed(user):
    """Whether they did, in the last CONFIRMATION_SECONDS."""
    mark = session.get("google_confirmed")
    return (isinstance(mark, dict) and mark.get("user_id") == user.id
            and time.time() - mark.get("at", 0) < CONFIRMATION_SECONDS)


def forget():
    """Drop what the session holds for signing in with Google, as logging out does."""
    session.pop("google_flow", None)
    session.pop("google_confirmed", None)
