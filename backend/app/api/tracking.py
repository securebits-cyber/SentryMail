"""Oeffentliche Tracking-Endpunkte: Pixel, Klick, Formular-Submission.

Bewusst ohne Authentifizierung - werden von den Kampagnen-Mails der
Empfaenger aufgerufen (siehe docs/phishing-awareness-smtp-konfiguration.md).
"""
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TrackingEventType
from app.services.tracking import record_event

router = APIRouter(prefix="/track", tags=["tracking"])

# 1x1 transparentes GIF fuer den Tracking-Pixel
_TRANSPARENT_PIXEL = bytes.fromhex(
    "47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b"
)


@router.get("/pixel")
def track_open(t: str, request: Request, db: Session = Depends(get_db)):
    record_event(
        db,
        tracking_token=t,
        event_type=TrackingEventType.OPENED,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return Response(content=_TRANSPARENT_PIXEL, media_type="image/gif")


@router.get("/click")
def track_click(t: str, url: str, request: Request, db: Session = Depends(get_db)):
    record_event(
        db,
        tracking_token=t,
        event_type=TrackingEventType.CLICKED,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return RedirectResponse(url=url)


@router.post("/submit")
def track_submit(t: str, request: Request, db: Session = Depends(get_db)):
    record_event(
        db,
        tracking_token=t,
        event_type=TrackingEventType.SUBMITTED,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {"status": "recorded"}
