"""Expiring, method/size/object-scoped grants; no browser receives S3 credentials."""

import base64
import hashlib
import hmac
import json
import os
import re
import time

from app.config import settings

MAX_UPLOAD = 25 * 1024 * 1024
MAX_DOWNLOAD = 100 * 1024 * 1024


def signing_secret():
    value = os.getenv("TRANSFER_TOKEN_SECRET", "")
    if len(value) < 32:
        raise RuntimeError("Missing transfer authentication")
    return value.encode()


def _validate(payload, now):
    if not isinstance(payload, dict):
        raise ValueError("INVALID_GRANT")
    fields = {"v", "method", "key", "expires", "size", "filename", "media_type"}
    if payload.get("v") == 2:
        fields.add("tool")
        if (
            payload.get("method") != "PUT"
            or not isinstance(payload.get("tool"), str)
            or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", payload["tool"])
            or len(payload["tool"]) > 64
        ):
            raise ValueError("INVALID_GRANT")
    if set(payload) != fields:
        raise ValueError("INVALID_GRANT")
    method = payload["method"]
    role = "upload" if method == "PUT" else "output"
    if (
        type(payload["v"]) is not int
        or payload["v"] not in {1, 2}
        or method not in {"PUT", "GET"}
        or not isinstance(payload["key"], str)
        or not re.fullmatch(role + r"/[a-f0-9]{32}", payload["key"])
        or type(payload["expires"]) is not int
        or not now < payload["expires"] <= now + 900
        or type(payload["size"]) is not int
        or not isinstance(payload["filename"], str)
        or not isinstance(payload["media_type"], str)
    ):
        raise ValueError("INVALID_GRANT")
    if method == "PUT":
        if not 0 < payload["size"] <= MAX_UPLOAD or payload["filename"] or payload["media_type"]:
            raise ValueError("INVALID_GRANT")
    elif (
        payload["size"] != 0
        or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}", payload["filename"])
        or not re.fullmatch(
            r"[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+(?:; charset=utf-8)?", payload["media_type"]
        )
    ):
        raise ValueError("INVALID_GRANT")
    return payload


def issue(method, key, ttl, *, size=0, filename="", media_type="", now=None, tool=None):
    now = int(time.time()) if now is None else now
    if type(ttl) is not int or not 1 <= ttl <= 900:
        raise ValueError("INVALID_GRANT")
    payload = _validate(
        {
            "v": 2 if tool is not None else 1,
            "method": method,
            "key": key,
            "expires": now + ttl,
            "size": size,
            "filename": filename,
            "media_type": media_type,
            **({"tool": tool} if tool is not None else {}),
        },
        now,
    )
    encoded = (
        base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode())
        .decode()
        .rstrip("=")
    )
    signature = hmac.new(signing_secret(), encoded.encode(), hashlib.sha256).hexdigest()
    return settings.transfer_public.rstrip("/") + "/transfers/" + encoded + "." + signature


def verify(token, now=None):
    now = int(time.time()) if now is None else now
    try:
        if len(token) > 2048:
            raise ValueError
        encoded, signature = token.split(".")
        expected = hmac.new(signing_secret(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        raw = base64.b64decode(encoded + "=" * (-len(encoded) % 4), altchars=b"-_", validate=True)
        return _validate(json.loads(raw), now)
    except (ValueError, TypeError, KeyError, UnicodeError):
        raise ValueError("INVALID_GRANT") from None
