"""FastAPI-Einstiegspunkt."""
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from app.api import audit, campaigns, dashboard, groups, health, landing_pages, me as me_api, results, sending_profiles, settings as settings_api, templates, tracking
from app.api import users as users_api
from app.auth import local as local_auth
from app.auth.oidc import is_oidc_enabled
from app.auth.oidc import router as oidc_router
from app.config import get_settings
from app.database import SessionLocal, get_db
from app.utils.logging import configure_logging

configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    db = SessionLocal()
    try:
        local_auth.ensure_bootstrap_admin(db)
    finally:
        db.close()
    yield


app = FastAPI(title="HumanShield.APP API", version="0.1.0", lifespan=lifespan)

# Session-Cookie fuer den OIDC-Authorization-Code-Flow (State/Nonce).
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/auth/config", tags=["auth"])
def auth_config(db: Session = Depends(get_db)) -> dict[str, bool]:
    """Sagt dem Frontend, ob OIDC/SSO als Zweitmethode verfuegbar ist."""
    return {"oidc_enabled": is_oidc_enabled(db)}


app.include_router(health.router)
app.include_router(dashboard.router)
app.include_router(local_auth.router)
app.include_router(oidc_router)
app.include_router(me_api.router)
app.include_router(users_api.router)
app.include_router(audit.router)
app.include_router(settings_api.router)
app.include_router(sending_profiles.router)
app.include_router(groups.router)
app.include_router(landing_pages.router)
app.include_router(campaigns.router)
app.include_router(templates.router)
app.include_router(results.router)
app.include_router(tracking.router)
