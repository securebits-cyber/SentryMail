# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Sicherheits-Helfer: Session-JWTs, Session-Cookies (httpOnly + CSRF) und Tracking-Token."""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Response

from app.config import get_settings

settings = get_settings()

# Browser-Session: das JWT liegt in einem httpOnly-Cookie (nicht per JS lesbar,
# schützt gegen Token-Diebstahl via XSS). Zusätzlich ein nicht-httpOnly CSRF-Token
# (Double-Submit): das Frontend spiegelt es in den X-CSRF-Token-Header.
SESSION_COOKIE = "hs_session"
CSRF_COOKIE = "hs_csrf"
CSRF_HEADER = "X-CSRF-Token"


def _cookie_common() -> dict[str, Any]:
    return {"secure": settings.COOKIE_SECURE, "samesite": "lax", "path": "/"}


def issue_session(response: Response, token: str) -> None:
    """Setzt Session- (httpOnly) und CSRF-Cookie auf die Antwort."""
    max_age = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    common = _cookie_common()
    response.set_cookie(SESSION_COOKIE, token, httponly=True, max_age=max_age, **common)
    response.set_cookie(CSRF_COOKIE, secrets.token_urlsafe(32), httponly=False, max_age=max_age, **common)


def clear_session(response: Response) -> None:
    """Löscht Session- und CSRF-Cookie (Logout)."""
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {"sub": subject, "exp": expire}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None


def generate_tracking_token() -> str:
    """Erzeugt einen unratebaren Token fuer Tracking-Pixel/Click-Links pro Empfaenger."""
    return secrets.token_urlsafe(32)
