# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Lizenz-/Entitlement-Logik (Online-Aktivierung mit signierter Lease).

Der Lizenzserver stellt kurzlebige, Ed25519-signierte Leases (JWT) aus. Der Core
erneuert sie periodisch online und prueft sie offline mit dem eingebauten Public
Key. Solange die Lease nicht abgelaufen ist (exp = Grace-Ende, 7 Tage), sind die
enthaltenen Features aktiv - auch wenn der Server zwischenzeitlich nicht
erreichbar ist. Ohne Lizenz laeuft der Core als reiner Open-Core (keine Add-ons).

Siehe docs/lizenz-addon-architektur.md.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import LicenseState, User
from app.utils.crypto import decrypt, encrypt

logger = logging.getLogger(__name__)

# Eingebauter Public Key des Anbieters (oeffentlich, unkritisch). Produktiv durch
# den eigenen Public Key ersetzen; der zugehoerige Private Key liegt nur auf dem
# Lizenzserver.
LICENSE_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPoHQaIQm81BBLDoj2gLB3cmgcij/lZrojZonkYw/oAg=
-----END PUBLIC KEY-----"""

# Bekannte Add-on-Features (fuer die /features-Antwort ans Frontend).
KNOWN_FEATURES = ["white_label", "multi_tenant", "ai_scoring"]


def get_or_create_license_state(db: Session) -> LicenseState:
    """Singleton-Zeile; erzeugt sie bei Bedarf und seedet den Key aus .env."""
    state = db.query(LicenseState).first()
    if state is None:
        state = LicenseState(features=[], last_status="no_license")
        env_key = get_settings().LICENSE_KEY
        if env_key:
            state.license_key_encrypted = encrypt(env_key)
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def _current_key(state: LicenseState) -> str | None:
    """Aktiver Lizenzschluessel: .env hat Vorrang, sonst der im Dashboard gepflegte."""
    env_key = get_settings().LICENSE_KEY
    if env_key:
        return env_key
    if state.license_key_encrypted:
        return decrypt(state.license_key_encrypted)
    return None


def verify_lease(lease_jwt: str | None) -> dict | None:
    """Lease-Signatur + Ablauf pruefen. Gibt die Claims zurueck oder None."""
    if not lease_jwt:
        return None
    try:
        return jwt.decode(lease_jwt, LICENSE_PUBLIC_KEY, algorithms=["EdDSA"])
    except jwt.PyJWTError:
        return None


def active_features(db: Session) -> list[str]:
    """Aktuell freigeschaltete Features aus der gecachten, gueltigen Lease."""
    state = get_or_create_license_state(db)
    claims = verify_lease(state.lease_jwt)
    if claims is None:
        return []
    return list(claims.get("features", []))


def has_feature(db: Session, feature_id: str) -> bool:
    return feature_id in active_features(db)


def _parse_iso(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def refresh_license(db: Session) -> LicenseState:
    """Lease online erneuern. Bei Serverfehler bleibt die letzte Lease gueltig (Grace)."""
    settings = get_settings()
    state = get_or_create_license_state(db)
    key = _current_key(state)

    if not settings.LICENSE_SERVER_URL or not key:
        state.last_status = "no_license"
        db.commit()
        return state

    try:
        resp = httpx.post(
            f"{settings.LICENSE_SERVER_URL.rstrip('/')}/v1/lease",
            json={
                "license_key": key,
                "instance_id": str(state.instance_id),
                "product": settings.LICENSE_PRODUCT,
                "product_version": "0.1.0",
            },
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        # Server nicht erreichbar -> letzte Lease weiter nutzen (Grace bis exp).
        logger.warning("Lizenzserver nicht erreichbar: %s", exc)
        state.last_status = "grace" if verify_lease(state.lease_jwt) else "unreachable"
        db.commit()
        return state

    state.last_checked_at = datetime.now(timezone.utc)

    if resp.status_code == 200:
        lease = resp.json().get("lease")
        claims = verify_lease(lease)
        if claims is None:
            # Unverifizierbare Lease (falscher Key/Manipulation) -> nicht uebernehmen.
            logger.error("Lease vom Server nicht verifizierbar")
            state.last_status = "error"
        else:
            state.lease_jwt = lease
            state.features = list(claims.get("features", []))
            state.customer = claims.get("customer")
            exp = claims.get("exp")
            state.expires_at = datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None
            state.license_expires = _parse_iso(claims.get("license_expires"))
            state.last_status = "active"
    elif resp.status_code in (401, 403, 410):
        # Widerruf/abgelaufen/Limit -> nicht erneuern; alte Lease laeuft in Grace weiter.
        if verify_lease(state.lease_jwt):
            state.last_status = "grace"
        else:
            state.last_status = "revoked" if resp.status_code == 401 else "expired"
    else:
        state.last_status = "grace" if verify_lease(state.lease_jwt) else "error"

    db.commit()
    return state


def set_license_key(db: Session, license_key: str) -> LicenseState:
    """Schluessel im Dashboard setzen/loeschen (verschluesselt), dann sofort pruefen."""
    state = get_or_create_license_state(db)
    state.license_key_encrypted = encrypt(license_key) if license_key.strip() else None
    db.commit()
    return refresh_license(db)


def license_status(db: Session) -> dict:
    """Statusobjekt fuer die Lizenz-Seite (admin)."""
    settings = get_settings()
    state = get_or_create_license_state(db)
    return {
        "instance_id": str(state.instance_id),
        "status": state.last_status,
        "customer": state.customer,
        "features": active_features(db),
        "expires_at": state.expires_at,
        "license_expires": state.license_expires,
        "last_checked_at": state.last_checked_at,
        "has_key": _current_key(state) is not None,
        "key_from_env": bool(settings.LICENSE_KEY),
        "server_configured": bool(settings.LICENSE_SERVER_URL),
    }


def features_map(db: Session) -> dict:
    """Kompakte Feature-/Lizenz-Antwort fuer das Frontend."""
    state = get_or_create_license_state(db)
    active = set(active_features(db))
    return {
        "features": {name: (name in active) for name in KNOWN_FEATURES},
        "license": {
            "status": state.last_status,
            "customer": state.customer,
            "expires": state.license_expires.isoformat() if state.license_expires else None,
        },
    }


def require_feature(feature_id: str):
    """FastAPI-Dependency: 403, wenn das Feature nicht lizenziert ist.

    Von Add-on-Routern genutzt: `Depends(require_feature("white_label"))`.
    """

    def _dependency(
        db: Session = Depends(get_db),
        _: User = Depends(get_current_user),
    ) -> None:
        if not has_feature(db, feature_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature_id}' ist nicht lizenziert.",
            )

    return _dependency
