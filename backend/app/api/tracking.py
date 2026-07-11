# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Oeffentliche Tracking-Endpunkte: Pixel, Landing Page, Formular-Submission.

Bewusst ohne Authentifizierung - werden von den Empfaengern der Kampagnen-Mails
aufgerufen. Erfasst wird nur, DASS jemand geoeffnet/geklickt/abgeschickt hat
(Awareness-Signal); die eingegebenen Formulardaten werden bewusst nicht
gespeichert.
"""
import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Recipient, TrackingEventType
from app.services.tracking import notify_submission, record_client_meta, record_event

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


def _client_meta(request: Request) -> dict:
    """Sammelt Kontext-Metadaten des Aufrufers fuer die Event-Anreicherung.

    Referrer und Accept-Language kommen aus den Request-Headern; UTM-Parameter
    (sofern der Betreiber sie an die Tracking-Links haengt) aus der Query.
    """
    params = request.query_params
    return {
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
        "referrer": request.headers.get("referer"),
        "accept_language": request.headers.get("accept-language"),
        "utm": {
            "utm_source": params.get("utm_source"),
            "utm_medium": params.get("utm_medium"),
            "utm_campaign": params.get("utm_campaign"),
        },
    }


@router.get("/pixel")
def track_open(t: str, request: Request, db: Session = Depends(get_db)):
    record_event(db, tracking_token=t, event_type=TrackingEventType.OPENED, **_client_meta(request))
    return Response(content=_TRANSPARENT_PIXEL, media_type="image/gif")


# Hinweis: Es gibt bewusst KEINEN /track/click-Endpunkt mit freiem "url"-Ziel.
# Klicks werden ueber /track/landing?t=<token> erfasst; das Weiterleitungsziel
# ergibt sich serverseitig aus der Kampagne (Landing Page bzw. deren
# redirect_url), niemals aus einem vom Empfaenger gelieferten Query-Parameter
# (kein offener Redirector).
@router.get("/landing", response_class=HTMLResponse)
def track_landing(t: str, request: Request, db: Session = Depends(get_db)):
    """Zaehlt den Klick und liefert die Landing Page der Kampagne aus."""
    record_event(db, tracking_token=t, event_type=TrackingEventType.CLICKED, **_client_meta(request))

    recipient = db.query(Recipient).filter(Recipient.tracking_token == t).first()
    campaign = recipient.campaign if recipient is not None else None
    page = campaign.landing_page if campaign is not None else None
    html = page.html_content if page is not None else _DEFAULT_PAGE

    # {{ logo }} durch das Seiten-Logo ersetzen (data:-URI rendert im Browser direkt).
    logo_html = (
        f'<img src="{page.logo_b64}" alt="" style="max-height:60px">'
        if page is not None and page.logo_b64
        else ""
    )
    html = re.sub(r"\{\{\s*logo\s*\}\}", lambda _: logo_html, html)

    # Alle Formulare auf die Submit-Erfassung umbiegen (mit Tracking-Token) und
    # per Beacon clientseitige Metadaten (Aufloesung/Sprache) nachtragen.
    t_quoted = quote(t, safe="")
    inject = (
        "<script>document.addEventListener('DOMContentLoaded',function(){"
        "document.querySelectorAll('form').forEach(function(f){"
        f"f.setAttribute('action','/track/submit?t={t_quoted}');f.setAttribute('method','POST');"
        "});"
        "try{var fp='';try{"
        # Leichtgewichtiger Fingerprint: Canvas-Rendering + stabile Merkmale,
        # zu einem 32-bit-Hex-Hash verdichtet (kein externes Skript, kein Cookie).
        "var c=document.createElement('canvas');var x=c.getContext('2d');"
        "x.textBaseline='top';x.font=\"14px 'Arial'\";x.fillStyle='#f60';x.fillRect(0,0,62,20);"
        "x.fillStyle='#069';x.fillText('HumanShield',2,2);"
        "var s=[navigator.userAgent,navigator.language,screen.width+'x'+screen.height,"
        "screen.colorDepth,new Date().getTimezoneOffset(),navigator.hardwareConcurrency||0,"
        "navigator.platform,c.toDataURL()].join('|');"
        "var h=0;for(var i=0;i<s.length;i++){h=((h<<5)-h+s.charCodeAt(i))|0;}"
        "fp=(h>>>0).toString(16);}catch(e){}"
        "new Image().src='/track/client?t=" + t_quoted + "'"
        "+'&res='+encodeURIComponent(screen.width+'x'+screen.height)"
        "+'&lang='+encodeURIComponent(navigator.language||'')"
        "+'&fp='+encodeURIComponent(fp);}catch(e){}"
        "});</script>"
    )
    if "</body>" in html:
        html = html.replace("</body>", inject + "</body>", 1)
    else:
        html = html + inject
    return HTMLResponse(content=html)


@router.get("/client")
def track_client(
    t: str,
    db: Session = Depends(get_db),
    res: str | None = None,
    lang: str | None = None,
    fp: str | None = None,
):
    """Beacon der Landing Page: traegt Bildschirmaufloesung/Sprache/Fingerprint nach.

    Liefert immer den 1x1-Pixel zurueck (verraet dem Empfaenger nichts, auch bei
    unbekanntem Token).
    """
    record_client_meta(db, tracking_token=t, screen_resolution=res, client_language=lang, fingerprint=fp)
    return Response(content=_TRANSPARENT_PIXEL, media_type="image/gif")


@router.post("/submit")
async def track_submit(t: str, request: Request, db: Session = Depends(get_db)):
    """Erfasst das Absenden (Awareness-Signal) und leitet weiter."""
    record_event(db, tracking_token=t, event_type=TrackingEventType.SUBMITTED, **_client_meta(request))

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
