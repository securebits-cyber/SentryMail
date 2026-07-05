# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Dependencies fuer Authentifizierung und Rollen-Autorisierung.

Token-Arten:
- Voll-Token: keine ``scope``-Claim. Erlaubt den regulaeren API-Zugriff.
- 2FA-Pre-Auth-Token: ``scope="2fa"``. Nur zum Abschliessen des Logins bzw.
  fuer die 2FA-Einrichtung bei erzwungener Aktivierung. Kein API-Zugriff.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.utils.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

TWOFA_SCOPE = "2fa"


def _user_from_credentials(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
    *,
    allowed_scopes: set[str | None],
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Nicht authentifiziert")
    payload = decode_access_token(credentials.credentials)
    if payload is None or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungueltiges oder abgelaufenes Token")
    if payload.get("scope") not in allowed_scopes:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token nicht fuer diesen Zugriff gueltig")
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Benutzer nicht gefunden oder inaktiv")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Regulaerer API-Zugriff - nur Voll-Token (ohne scope)."""
    return _user_from_credentials(credentials, db, allowed_scopes={None})


def get_twofa_pending_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Nur 2FA-Pre-Auth-Token: schliesst den Login ab."""
    return _user_from_credentials(credentials, db, allowed_scopes={TWOFA_SCOPE})


def get_user_for_2fa_setup(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """2FA-Einrichtung: Voll-Token (Profil) ODER Pre-Auth-Token (erzwungene Aktivierung)."""
    return _user_from_credentials(credentials, db, allowed_scopes={None, TWOFA_SCOPE})


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin-Rechte erforderlich")
    return current_user
