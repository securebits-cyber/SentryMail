# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer Session-JWTs und Tracking-Token."""
from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings
from app.utils.security import (
    create_access_token,
    decode_access_token,
    generate_tracking_token,
)


def test_create_and_decode_token():
    token = create_access_token(subject="user-123")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert "exp" in payload


def test_extra_claims_are_embedded():
    token = create_access_token(subject="user-123", extra_claims={"scope": "2fa"})
    payload = decode_access_token(token)
    assert payload["scope"] == "2fa"


def test_decode_rejects_tampered_token():
    token = create_access_token(subject="user-123")
    # Signatur zerstoeren
    assert decode_access_token(token + "x") is None


def test_decode_rejects_foreign_signature():
    """Ein mit fremdem Secret signiertes Token wird abgelehnt."""
    settings = get_settings()
    forged = jwt.encode({"sub": "attacker"}, "not-the-real-secret", algorithm=settings.ALGORITHM)
    assert decode_access_token(forged) is None


def test_decode_rejects_expired_token():
    settings = get_settings()
    expired = jwt.encode(
        {"sub": "user-123", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    assert decode_access_token(expired) is None


def test_tracking_tokens_are_unique_and_long():
    tokens = {generate_tracking_token() for _ in range(100)}
    assert len(tokens) == 100
    assert all(len(t) >= 32 for t in tokens)
