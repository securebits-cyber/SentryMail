# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Oeffentliche Tracking-Endpunkte: Pixel, Landing Page, Formular-Submission.

Bewusst ohne Authentifizierung - werden von den Empfaengern der Kampagnen-Mails
aufgerufen. Erfasst wird nur, DASS jemand geoeffnet/geklickt/abgeschickt hat
(Awareness-Signal); die eingegebenen Formulardaten werden bewusst nicht
gespeichert.
"""
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Recipient, TrackingEventType
from app.services.tracking import notify_submission, record_event

settings = get_settings()

router = APIRouter(prefix="/track", tags=["tracking"])

# 1x1 transparentes GIF fuer den Tracking-Pixel
_TRANSPARENT_PIXEL = bytes.fromhex(
    "47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b"
)

_DEFAULT_PAGE = (
    "<!doctype html><html lang='de'><meta charset='utf-8'>"
    "<title>Hinweis</title><body style='font-family:sans-serif;max-width:640px;margin:4rem auto'>"
    "<h1>Sicherheits-Hinweis</h1><p>Diese Seite war Teil eines Phishing-Awareness-Tests.</p></body></html>"
)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    return (request.client.host if request.client else None), request.headers.get("user-agent")


@router.get("/pixel")
def track_open(t: str, request: Request, db: Session = Depends(get_db)):
    ip, ua = _client_meta(request)
    record_event(db, tracking_token=t, event_type=TrackingEventType.OPENED, ip_address=ip, user_agent=ua)
    return Response(content=_TRANSPARENT_PIXEL, media_type="image/gif")


@router.get("/click")
def track_click(t: str, url: str, request: Request, db: Session = Depends(get_db)):
    ip, ua = _client_meta(request)
    event = record_event(db, tracking_token=t, event_type=TrackingEventType.CLICKED, ip_address=ip, user_agent=ua)

    # Open-Redirect-Schutz: nur bei bekanntem Tracking-Token und nur auf
    # http(s)-Ziele weiterleiten (kein javascript:/data: und kein token-loser
    # Missbrauch als offener Redirector).
    if event is None or urlparse(url).scheme not in ("http", "https"):
        return HTMLResponse(content=_DEFAULT_PAGE)
    return RedirectResponse(url=url)


@router.get("/landing", response_class=HTMLResponse)
def track_landing(t: str, request: Request, db: Session = Depends(get_db)):
    """Zaehlt den Klick und liefert die Landing Page der Kampagne aus."""
    ip, ua = _client_meta(request)
    record_event(db, tracking_token=t, event_type=TrackingEventType.CLICKED, ip_address=ip, user_agent=ua)

    recipient = db.query(Recipient).filter(Recipient.tracking_token == t).first()
    campaign = recipient.campaign if recipient is not None else None
    page = campaign.landing_page if campaign is not None else None
    html = page.html_content if page is not None else _DEFAULT_PAGE

    # Alle Formulare auf die Submit-Erfassung umbiegen (mit Tracking-Token).
    inject = (
        "<script>document.addEventListener('DOMContentLoaded',function(){"
        "document.querySelectorAll('form').forEach(function(f){"
        f"f.setAttribute('action','/track/submit?t={t}');f.setAttribute('method','POST');"
        "});});</script>"
    )
    if "</body>" in html:
        html = html.replace("</body>", inject + "</body>", 1)
    else:
        html = html + inject
    return HTMLResponse(content=html)


@router.post("/submit")
async def track_submit(t: str, request: Request, db: Session = Depends(get_db)):
    """Erfasst das Absenden (Awareness-Signal) und leitet weiter."""
    ip, ua = _client_meta(request)
    record_event(db, tracking_token=t, event_type=TrackingEventType.SUBMITTED, ip_address=ip, user_agent=ua)

    recipient = db.query(Recipient).filter(Recipient.tracking_token == t).first()
    campaign = recipient.campaign if recipient is not None else None
    page = campaign.landing_page if campaign is not None else None

    # Abgeschickte Textfelder nur weiterreichen, wenn die Landing Page das
    # Erfassen aktiviert hat (capture_credentials). Der Core speichert selbst
    # nichts; ein Business-Add-on (Passwortabfrage) verarbeitet die Felder ueber
    # notify_submission und liest bei Bedarf capture_passwords von der Page.
    # Dateien (UploadFile mit .filename) werden bewusst ausgelassen.
    if recipient is not None and page is not None and page.capture_credentials:
        try:
            form = await request.form()
            data = {k: str(v) for k, v in form.items() if k != "t" and not hasattr(v, "filename")}
        except Exception:  # noqa: BLE001
            data = {}
        if data:
            notify_submission(recipient, data)

    target = (page.redirect_url if page is not None else None) or f"https://{settings.APP_DOMAIN}/track/done"
    return RedirectResponse(url=target, status_code=303)


@router.get("/done", response_class=HTMLResponse)
def track_done():
    return HTMLResponse(content=_DEFAULT_PAGE)
