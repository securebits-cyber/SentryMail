# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""FastAPI-Einstiegspunkt."""
import asyncio
import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette.middleware.sessions import SessionMiddleware

from app.api import audit, campaigns, dashboard, groups, health, landing_pages, license as license_api, me as me_api, reports, results, sending_profiles, settings as settings_api, templates, tracking
from app.api import users as users_api
from app.api import version as version_api
from app.addon_loader import load_addons
from app.auth import local as local_auth
from app.auth.oidc import is_oidc_enabled
from app.auth.oidc import router as oidc_router
from app.config import get_settings
from app.database import SessionLocal, get_db, run_core_migrations
from app.services import license as license_service
from app.utils.logging import configure_logging
from app.utils.security import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE
from app.version import APP_VERSION

configure_logging()
settings = get_settings()
logger = logging.getLogger(__name__)


def _refresh_license_once() -> None:
    db = SessionLocal()
    try:
        license_service.refresh_license(db)
    finally:
        db.close()


async def _license_refresh_loop() -> None:
    interval = max(1, settings.LICENSE_REFRESH_INTERVAL_HOURS) * 3600
    while True:
        try:
            await asyncio.to_thread(_refresh_license_once)
        except Exception:  # noqa: BLE001 - Loop soll nie sterben
            logger.exception("Lizenz-Refresh fehlgeschlagen")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Core-Schema beim Start automatisch auf head bringen (vor dem ersten DB-Zugriff).
    run_core_migrations()

    db = SessionLocal()
    try:
        local_auth.ensure_bootstrap_admin(db)
        license_service.get_or_create_license_state(db)
    finally:
        db.close()

    refresh_task = asyncio.create_task(_license_refresh_loop()) if settings.LICENSE_SERVER_URL else None
    try:
        yield
    finally:
        if refresh_task is not None:
            refresh_task.cancel()


app = FastAPI(title="SentryMail API", version=APP_VERSION, lifespan=lifespan)

# Session-Cookie fuer den OIDC-Authorization-Code-Flow (State/Nonce).
app.add_middleware(SessionMiddleware, secret_key=settings.SECRET_KEY)

# Mit allow_credentials=True ist ein Wildcard-Origin gefährlich (jede fremde Seite
# könnte mit den Anmeldedaten des Nutzers auf die API zugreifen). Ein versehentlich
# gesetztes "*" wird daher ignoriert statt durchgereicht.
_cors_origins = settings.cors_origins_list
if "*" in _cors_origins:
    logger.warning(
        "CORS_ORIGINS enthält '*' — mit Credentials unsicher und wird ignoriert. "
        "Bitte konkrete Origins konfigurieren."
    )
    _cors_origins = [o for o in _cors_origins if o != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def csrf_protect(request, call_next):
    """Double-Submit-CSRF-Schutz für Cookie-authentifizierte Anfragen.

    Greift nur, wenn per Session-Cookie authentifiziert wird (Browser). Anfragen
    mit Authorization-Header (API-/Bearer-Clients) sind nicht CSRF-anfällig und
    werden übersprungen; ebenso öffentliche Endpunkte ohne Session-Cookie (Login,
    Tracking/Capture, IdP-Callbacks).

    Der öffentliche Tracking-/Capture-Pfad `/track/*` wird immer übersprungen:
    Die Landing Page wird als reines serverseitiges HTML-Formular ausgeliefert
    (kein React/Axios, also kein CSRF-Header) und ist bewusst ohne Auth erreichbar.
    Ohne diese Pfad-Ausnahme schlägt der Formular-POST fehl, sobald der Aufrufer
    im selben Browser zufällig ein Session-Cookie hat (z. B. der eingeloggte
    Admin/Tester) — same-origin würde das Cookie mitgesendet und die Prüfung
    fälschlich greifen.
    """
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and not request.url.path.startswith("/track/"):
        has_session = bool(request.cookies.get(SESSION_COOKIE))
        uses_bearer = bool(request.headers.get("authorization"))
        if has_session and not uses_bearer:
            sent = request.headers.get(CSRF_HEADER)
            expected = request.cookies.get(CSRF_COOKIE)
            if not sent or not expected or not secrets.compare_digest(sent, expected):
                return JSONResponse(status_code=403, content={"detail": "CSRF-Token fehlt oder ungültig"})
    return await call_next(request)


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
app.include_router(reports.router)
app.include_router(tracking.router)
app.include_router(license_api.router)
app.include_router(version_api.router)

# Private Add-on-Pakete (falls installiert) registrieren. Ohne Paket ein No-Op.
load_addons(app)
