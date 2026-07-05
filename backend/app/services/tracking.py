# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tracking-Logik: Events zu Empfaengern erfassen und Kampagnen-Ergebnisse aggregieren."""
from sqlalchemy.orm import Session

from app.models import Recipient, TrackingEvent, TrackingEventType
from app.schemas import CampaignResultOut, RecipientResultOut


def record_event(
    db: Session,
    tracking_token: str,
    event_type: TrackingEventType,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> TrackingEvent | None:
    recipient = db.query(Recipient).filter(Recipient.tracking_token == tracking_token).first()
    if recipient is None:
        return None

    event = TrackingEvent(
        recipient_id=recipient.id,
        event_type=event_type,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
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
