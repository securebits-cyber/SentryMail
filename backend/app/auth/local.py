"""Lokaler Login (E-Mail/Passwort) - primaere Anmeldemethode.

Konten werden ausschliesslich von Admins angelegt (siehe app/api/users.py),
kein Self-Signup. OIDC (app/auth/oidc.py) ist eine optionale Zweitmethode.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User, UserRole
from app.utils.passwords import hash_password, verify_password
from app.utils.security import create_access_token

router = APIRouter(prefix="/auth/local", tags=["auth"])


def ensure_bootstrap_admin(db: Session) -> None:
    """Legt beim ersten Start einen Admin aus INITIAL_ADMIN_EMAIL/PASSWORD an,
    falls beide gesetzt sind und noch kein User mit dieser E-Mail existiert."""
    settings = get_settings()
    if not settings.INITIAL_ADMIN_EMAIL or not settings.INITIAL_ADMIN_PASSWORD:
        return

    if db.query(User).filter(User.email == settings.INITIAL_ADMIN_EMAIL).first() is not None:
        return

    db.add(
        User(
            email=settings.INITIAL_ADMIN_EMAIL,
            full_name="Admin",
            password_hash=hash_password(settings.INITIAL_ADMIN_PASSWORD),
            role=UserRole.ADMIN,
        )
    )
    db.commit()


class LocalLoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/login", response_model=TokenResponse)
def login(payload: LocalLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="E-Mail oder Passwort ist falsch"
    )

    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or user.password_hash is None:
        # Absichtlich dieselbe Fehlermeldung wie bei falschem Passwort -
        # verraet nicht, ob die E-Mail-Adresse existiert.
        raise invalid_credentials

    if not verify_password(payload.password, user.password_hash):
        raise invalid_credentials

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Benutzer ist deaktiviert")

    return TokenResponse(access_token=create_access_token(subject=str(user.id)))
