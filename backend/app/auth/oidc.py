# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Generischer OIDC-Client.

Kennt keinen bestimmten Identity Provider - Issuer, Client-ID, Client-Secret
und Redirect-URI kommen aus der im Dashboard verwalteten OidcConfig (DB).
Funktioniert mit jedem Standard-OIDC-Provider (Authentik, Keycloak, Entra ID,
Okta, ...). OIDC ist eine optionale Zweitanmeldung; ist es nicht aktiviert,
laeuft die App vollstaendig ohne IdP.
"""
import logging

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import OidcConfig, User
from app.utils.crypto import decrypt
from app.utils.security import create_access_token, issue_session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def is_oidc_enabled(db: Session) -> bool:
    """OIDC ist nutzbar, wenn aktiviert und vollstaendig konfiguriert."""
    config = db.query(OidcConfig).first()
    return bool(
        config
        and config.enabled
        and config.issuer
        and config.client_id
        and config.client_secret_encrypted
    )


def _build_oauth(config: OidcConfig) -> OAuth:
    """Baut pro Request einen OAuth-Client aus der aktuellen DB-Config."""
    oauth = OAuth()
    oauth.register(
        name="oidc",
        server_metadata_url=f"{config.issuer.rstrip('/')}/.well-known/openid-configuration",
        client_id=config.client_id,
        client_secret=decrypt(config.client_secret_encrypted),
        client_kwargs={"scope": "openid profile email"},
    )
    return oauth


def _config_or_400(db: Session) -> OidcConfig:
    if not is_oidc_enabled(db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC ist nicht konfiguriert/aktiviert (siehe Einstellungen).",
        )
    return db.query(OidcConfig).first()


@router.get("/login")
async def login(request: Request, db: Session = Depends(get_db)):
    """Leitet zum konfigurierten OIDC-Provider weiter."""
    config = _config_or_400(db)
    oauth = _build_oauth(config)
    return await oauth.oidc.authorize_redirect(request, config.redirect_uri)


def _get_or_create_user(
    db: Session, subject: str, email: str | None, full_name: str, email_verified: bool
) -> User:
    """User zum OIDC-Subject finden, per E-Mail verknuepfen oder neu anlegen.

    Der E-Mail-Fallback verknuepft bestehende Konten (lokal angelegt) mit dem
    SSO-Login - sonst kollidiert das Neuanlegen mit dem Unique-Index auf email
    (500er im Callback). Verknuepft wird nur, wenn der IdP die E-Mail als
    verifiziert meldet und das Konto noch nicht foederiert ist; eine beim IdP
    frei registrierbare, unverifizierte E-Mail darf kein bestehendes Konto
    uebernehmen.
    """
    user = db.query(User).filter(User.oidc_subject == subject).first()
    if user is not None:
        user.email = email or user.email
        user.full_name = full_name
    else:
        existing = db.query(User).filter(User.email == email).first() if email else None
        if existing is not None:
            if not email_verified or existing.oidc_subject is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "Es existiert bereits ein Konto mit dieser E-Mail-Adresse. "
                        "Automatische Verknüpfung nicht möglich (E-Mail nicht "
                        "verifiziert oder Konto bereits mit SSO verknüpft)."
                    ),
                )
            existing.oidc_subject = subject
            existing.full_name = full_name
            user = existing
        else:
            user = User(oidc_subject=subject, email=email, full_name=full_name)
            db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/callback")
async def callback(request: Request, db: Session = Depends(get_db)):
    """Tauscht den Callback-Code gegen Tokens, legt/aktualisiert den User an und
    stellt eine eigene Session als JWT aus."""
    config = _config_or_400(db)
    oauth = _build_oauth(config)

    token = await oauth.oidc.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if userinfo is None:
        userinfo = await oauth.oidc.userinfo(token=token)

    subject = userinfo["sub"]
    email = userinfo.get("email")
    full_name = userinfo.get("name", email or subject)

    # Betreiber koennen per Option festlegen, dass E-Mails dieses IdP als
    # verifiziert gelten (fuer IdPs, die email_verified nicht/als false senden).
    email_verified = userinfo.get("email_verified") is True or config.trust_email

    user = _get_or_create_user(db, subject, email, full_name, email_verified)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Konto ist deaktiviert.",
        )

    # Session als httpOnly-Cookie setzen und ohne Token in der URL zur App
    # zurückleiten (kein Token in Fragment/Logs, nicht per JS lesbar).
    session_token = create_access_token(subject=str(user.id))
    redirect = RedirectResponse(url="/")
    issue_session(redirect, session_token)
    return redirect
