# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tracking-Logik: Events zu Empfaengern erfassen und Kampagnen-Ergebnisse aggregieren.

Event-Hook: Add-ons koennen sich fuer erfasste Tracking-Events registrieren
(z. B. Webhooks im Business-Add-on), ohne dass der Core deren Logik kennt. Ein
Listener bekommt (event, recipient); Fehler eines Listeners brechen das Tracking
nicht ab.
"""
import logging
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.models import Recipient, TrackingEvent, TrackingEventType
from app.schemas import CampaignResultOut, RecipientResultOut
from app.utils.useragent import parse_user_agent

logger = logging.getLogger(__name__)

_event_listeners: list[Callable[[TrackingEvent, Recipient], None]] = []
_submission_handlers: list[Callable[[Recipient, dict], None]] = []


def register_event_listener(listener: Callable[[TrackingEvent, Recipient], None]) -> None:
    """Registriert einen Listener fuer erfasste Tracking-Events (von Add-ons)."""
    _event_listeners.append(listener)


def register_submission_handler(handler: Callable[[Recipient, dict], None]) -> None:
    """Registriert einen Handler fuer abgeschickte Formulardaten (von Add-ons).

    Der Core erfasst die Daten nicht selbst (Passwortabfrage ist ein Business-
    Feature); ohne Handler werden abgeschickte Felder verworfen.
    """
    _submission_handlers.append(handler)


def _notify(event: TrackingEvent, recipient: Recipient) -> None:
    for listener in _event_listeners:
        try:
            listener(event, recipient)
        except Exception:  # noqa: BLE001 - ein Listener darf das Tracking nie abbrechen
            logger.exception("Tracking-Event-Listener fehlgeschlagen")


def notify_submission(recipient: Recipient, data: dict) -> None:
    """Ruft registrierte Submission-Handler mit den abgeschickten Formulardaten."""
    for handler in _submission_handlers:
        try:
            handler(recipient, data)
        except Exception:  # noqa: BLE001 - ein Handler darf das Tracking nie abbrechen
            logger.exception("Submission-Handler fehlgeschlagen")


def record_event(
    db: Session,
    tracking_token: str,
    event_type: TrackingEventType,
    ip_address: str | None = None,
    user_agent: str | None = None,
    referrer: str | None = None,
    accept_language: str | None = None,
    utm: dict[str, str | None] | None = None,
) -> TrackingEvent | None:
    recipient = db.query(Recipient).filter(Recipient.tracking_token == tracking_token).first()
    if recipient is None:
        return None

    browser, os_name, device_type = parse_user_agent(user_agent)
    utm = utm or {}
    event = TrackingEvent(
        recipient_id=recipient.id,
        event_type=event_type,
        ip_address=ip_address,
        user_agent=user_agent,
        browser=browser,
        os=os_name,
        device_type=device_type,
        referrer=referrer,
        accept_language=accept_language,
        utm_source=utm.get("utm_source"),
        utm_medium=utm.get("utm_medium"),
        utm_campaign=utm.get("utm_campaign"),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    _notify(event, recipient)
    return event


def get_campaign_results(db: Session, campaign_id) -> CampaignResultOut:
    recipients = (
        db.query(Recipient).filter(Recipient.campaign_id == campaign_id).order_by(Recipient.email).all()
    )
    events = (
        db.query(TrackingEvent.recipient_id, TrackingEvent.event_type)
        .join(Recipient, Recipient.id == TrackingEvent.recipient_id)
        .filter(Recipient.campaign_id == campaign_id)
        .all()
    )
    types_by_recipient: dict = {}
    for recipient_id, event_type in events:
        types_by_recipient.setdefault(recipient_id, set()).add(event_type)

    rows = [
        RecipientResultOut(
            email=r.email,
            first_name=r.first_name,
            last_name=r.last_name,
            position=r.position,
            department=r.department,
            criticality=r.criticality,
            sent_at=r.sent_at,
            opened=TrackingEventType.OPENED in types_by_recipient.get(r.id, ()),
            clicked=TrackingEventType.CLICKED in types_by_recipient.get(r.id, ()),
            submitted=TrackingEventType.SUBMITTED in types_by_recipient.get(r.id, ()),
        )
        for r in recipients
    ]

    def agg(event_type: TrackingEventType) -> int:
        return sum(1 for types in types_by_recipient.values() if event_type in types)

    return CampaignResultOut(
        campaign_id=campaign_id,
        total_recipients=len(recipients),
        sent=sum(1 for r in recipients if r.sent_at is not None),
        opened=agg(TrackingEventType.OPENED),
        clicked=agg(TrackingEventType.CLICKED),
        submitted=agg(TrackingEventType.SUBMITTED),
        recipients=rows,
    )
