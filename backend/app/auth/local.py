# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Lokaler Login (E-Mail/Passwort) - primaere Anmeldemethode.

Konten werden ausschliesslich von Admins angelegt (siehe app/api/users.py),
kein Self-Signup. OIDC (app/auth/oidc.py) ist eine optionale Zweitmethode.
Der Login ist zweistufig, sobald 2FA aktiv oder per Policy erzwungen ist.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.settings import get_or_create_security_config
from app.auth.permissions import TWOFA_SCOPE, get_twofa_pending_user
from app.config import get_settings
from app.database import get_db
from app.models import User, UserRole
from app.schemas import LoginResult, TwoFACodeIn
from app.services import ratelimit, twofa
from app.services.audit import client_ip, record_audit
from app.utils.passwords import hash_password, verify_password
from app.utils.security import clear_session, create_access_token, issue_session

router = APIRouter(prefix="/auth/local", tags=["auth"])

# Brute-Force-Schutz: pro Konto+IP fensterbasierter Fehlversuchs-Lockout.
_LOGIN_MAX_FAILURES = 10
_LOGIN_WINDOW_SECONDS = 15 * 60
_TWOFA_MAX_FAILURES = 6
_TWOFA_WINDOW_SECONDS = 10 * 60

_too_many = HTTPException(
    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    detail="Zu viele Fehlversuche. Bitte später erneut versuchen.",
)


def _login_key(email: str, ip: str) -> str:
    return f"login:fail:{email.strip().lower()}:{ip}"


def _twofa_key(user: User, ip: str) -> str:
    return f"2fa:fail:{user.id}:{ip}"


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


def _pre_auth_token(user: User) -> str:
    return create_access_token(subject=str(user.id), extra_claims={"scope": TWOFA_SCOPE})


@router.post("/login", response_model=LoginResult)
def login(payload: LocalLoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> LoginResult:
    ip = client_ip(request)
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="E-Mail oder Passwort ist falsch"
    )

    login_key = _login_key(payload.email, ip)
    if ratelimit.is_locked(login_key, limit=_LOGIN_MAX_FAILURES):
        record_audit(
            db,
            action="login.ratelimited",
            category="auth",
            description=f"Login-Lockout (zu viele Fehlversuche) für {payload.email}",
            actor_email=payload.email,
            ip=ip,
        )
        raise _too_many

    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or user.password_hash is None or not verify_password(payload.password, user.password_hash):
        ratelimit.register_failure(login_key, window_seconds=_LOGIN_WINDOW_SECONDS)
        # Absichtlich dieselbe Fehlermeldung - verraet nicht, ob die E-Mail existiert.
        record_audit(
            db,
            action="login.failed",
            category="auth",
            description=f"Fehlgeschlagene Anmeldung für {payload.email}",
            actor_email=payload.email,
            ip=ip,
        )
        raise invalid_credentials

    ratelimit.reset(login_key)

    if not user.is_active:
        record_audit(
            db,
            action="login.blocked",
            category="auth",
            description="Anmeldung eines deaktivierten Kontos blockiert",
            actor=user,
            ip=ip,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Benutzer ist deaktiviert")

    policy = get_or_create_security_config(db).require_2fa

    # 2FA aktiv -> zweiter Schritt erforderlich.
    if user.twofa_enabled:
        if user.twofa_method == "email":
            code = twofa.new_email_code()
            twofa.set_email_code(user, code)
            db.commit()
            twofa.send_email_2fa_code(db, user, code)
        return LoginResult(twofa_required=True, method=user.twofa_method, pre_auth_token=_pre_auth_token(user))

    # 2FA per Policy erzwungen, aber noch nicht eingerichtet -> Einrichtung erzwingen.
    if twofa.twofa_required_for(user, policy):
        return LoginResult(twofa_required=True, setup_required=True, pre_auth_token=_pre_auth_token(user))

    token = create_access_token(subject=str(user.id))
    issue_session(response, token)
    record_audit(db, action="login.success", category="auth", description="Erfolgreiche Anmeldung", actor=user, ip=ip)
    return LoginResult(access_token=token)


@router.post("/login/2fa", response_model=LoginResult)
def login_verify_2fa(
    payload: TwoFACodeIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_twofa_pending_user),
) -> LoginResult:
    ip = client_ip(request)
    twofa_key = _twofa_key(user, ip)
    if ratelimit.is_locked(twofa_key, limit=_TWOFA_MAX_FAILURES):
        # Bei Lockout den E-Mail-Code verwerfen -> erzwingt einen frischen Code.
        twofa.clear_email_code(user)
        db.commit()
        record_audit(db, action="login.ratelimited", category="auth", description="2FA-Lockout (zu viele Fehlversuche)", actor=user, ip=ip)
        raise _too_many

    if twofa.verify_second_factor(user, payload.code):
        ratelimit.reset(twofa_key)
        db.commit()  # verbrauchten Backup-Code / geleerten E-Mail-Code persistieren
        token = create_access_token(subject=str(user.id))
        issue_session(response, token)
        record_audit(db, action="login.success", category="auth", description="Erfolgreiche Anmeldung (2FA)", actor=user, ip=ip)
        return LoginResult(access_token=token)

    ratelimit.register_failure(twofa_key, window_seconds=_TWOFA_WINDOW_SECONDS)
    record_audit(db, action="login.failed", category="auth", description="Falscher 2FA-Code", actor=user, ip=ip)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Code ist ungültig")


@router.post("/logout")
def logout(response: Response) -> dict:
    """Meldet den Browser ab, indem Session- und CSRF-Cookie gelöscht werden."""
    clear_session(response)
    return {"ok": True}
