"""Generischer OIDC-Client.

Kennt keinen bestimmten Identity Provider - Issuer, Client-ID, Client-Secret
und Redirect-URI kommen ausschliesslich aus Settings (.env). Funktioniert mit
jedem Standard-OIDC-Provider (Authentik, Keycloak, Entra ID, Okta, ...).
"""
import logging

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.utils.security import create_access_token

logger = logging.getLogger(__name__)
settings = get_settings()

# OIDC ist optional: lokaler Login (siehe app/auth/local.py) ist die primaere
# Anmeldemethode, OIDC eine optionale Zweitmethode. Nur aktiv, wenn OIDC_ISSUER
# konfiguriert ist - sonst kann die App auch ganz ohne IdP betrieben werden.
oidc_enabled = settings.OIDC_ISSUER is not None

oauth = OAuth()
if oidc_enabled:
    oauth.register(
        name="oidc",
        server_metadata_url=f"{settings.OIDC_ISSUER.rstrip('/')}/.well-known/openid-configuration",
        client_id=settings.OIDC_CLIENT_ID,
        client_secret=settings.OIDC_CLIENT_SECRET,
        client_kwargs={"scope": "openid profile email"},
    )

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login")
async def login(request: Request):
    """Leitet zum konfigurierten OIDC-Provider weiter."""
    return await oauth.oidc.authorize_redirect(request, settings.OIDC_REDIRECT_URI)


@router.get("/callback")
async def callback(request: Request, db: Session = Depends(get_db)):
    """Tauscht den Callback-Code gegen Tokens, legt/aktualisiert den User an und
    stellt eine eigene Session als JWT aus."""
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

    # Token im URL-Fragment (nicht Query-Parameter) uebergeben, damit es nicht
    # in Server-/Proxy-Zugriffslogs landet - das Frontend liest es clientseitig aus.
    session_token = create_access_token(subject=str(user.id))
    return RedirectResponse(url=f"/#token={session_token}")
