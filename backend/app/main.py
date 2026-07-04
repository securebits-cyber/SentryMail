"""FastAPI-Einstiegspunkt."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api import campaigns, health, results, templates, tracking
from app.auth.oidc import router as oidc_router
from app.config import get_settings
from app.utils.logging import configure_logging

configure_logging()
settings = get_settings()

app = FastAPI(title="PhishAware API", version="0.1.0")

# Session-Cookie fuer den OIDC-Authorization-Code-Flow (State/Nonce).
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(oidc_router)
app.include_router(campaigns.router)
app.include_router(templates.router)
app.include_router(results.router)
app.include_router(tracking.router)
