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

    user = db.query(User).filter(User.oidc_subject == subject).first()
    if user is None:
        user = User(oidc_subject=subject, email=email, full_name=full_name)
        db.add(user)
    else:
        user.email = email
        user.full_name = full_name
    db.commit()
    db.refresh(user)

    # Session als httpOnly-Cookie setzen und ohne Token in der URL zur App
    # zurückleiten (kein Token in Fragment/Logs, nicht per JS lesbar).
    session_token = create_access_token(subject=str(user.id))
    redirect = RedirectResponse(url="/")
    issue_session(redirect, session_token)
    return redirect
