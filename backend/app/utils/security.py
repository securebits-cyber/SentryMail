# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Sicherheits-Helfer: Session-JWTs und Tracking-Token."""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.config import get_settings

settings = get_settings()


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
