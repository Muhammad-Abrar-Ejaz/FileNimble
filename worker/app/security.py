import base64
import hashlib
import hmac
import secrets
import time

from fastapi import HTTPException

from app.config import settings


def fail(code, message, status=400):
    raise HTTPException(status, {"error": code, "message": message})


def digest(value):
    return hmac.new(settings.secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def issue_session(now=None):
    body = f"{secrets.token_hex(32)}:{int(now if now is not None else time.time()) + settings.session_ttl}"
    return base64.urlsafe_b64encode(body.encode()).decode() + "." + digest(body)


def read_session(token, now=None):
    try:
        encoded, signature = token.split(".")
        body = base64.urlsafe_b64decode(encoded).decode()
        sid, expiry = body.split(":")
        if (
            len(sid) != 64
            or not hmac.compare_digest(signature, digest(body))
            or int(expiry) <= (now if now is not None else time.time())
        ):
            raise ValueError
        return digest(sid)
    except (ValueError, UnicodeError):
        fail("NOT_AUTHORIZED", "Session is invalid or expired.", 401)


def require_internal(value):
    if not value or not hmac.compare_digest(value, settings.internal_secret):
        fail("NOT_AUTHORIZED", "Not authorized.", 401)
