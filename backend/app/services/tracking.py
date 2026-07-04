"""Tracking-Logik: Events zu Empfaengern erfassen und Kampagnen-Ergebnisse aggregieren."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Recipient, TrackingEvent, TrackingEventType
from app.schemas import CampaignResultOut


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
    total_recipients = db.query(func.count(Recipient.id)).filter(Recipient.campaign_id == campaign_id).scalar()

    def count_event(event_type: TrackingEventType) -> int:
        return (
            db.query(func.count(func.distinct(TrackingEvent.recipient_id)))
            .join(Recipient, Recipient.id == TrackingEvent.recipient_id)
            .filter(Recipient.campaign_id == campaign_id, TrackingEvent.event_type == event_type)
            .scalar()
        )

    return CampaignResultOut(
        campaign_id=campaign_id,
        total_recipients=total_recipients or 0,
        sent=count_event(TrackingEventType.SENT),
        opened=count_event(TrackingEventType.OPENED),
        clicked=count_event(TrackingEventType.CLICKED),
        submitted=count_event(TrackingEventType.SUBMITTED),
    )
