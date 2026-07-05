# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Aggregierte Uebersicht: KPIs und durchgefallene Empfaenger."""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import Campaign, Recipient, TrackingEvent, TrackingEventType, User
from app.schemas import DashboardSummary, FailedRecipient

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    def distinct_recipients(event_type: TrackingEventType) -> int:
        return (
            db.query(func.count(func.distinct(TrackingEvent.recipient_id)))
            .filter(TrackingEvent.event_type == event_type)
            .scalar()
            or 0
        )

    return DashboardSummary(
        campaigns=db.query(func.count(Campaign.id)).scalar() or 0,
        recipients=db.query(func.count(Recipient.id)).scalar() or 0,
        sent=distinct_recipients(TrackingEventType.SENT),
        opened=distinct_recipients(TrackingEventType.OPENED),
        clicked=distinct_recipients(TrackingEventType.CLICKED),
        submitted=distinct_recipients(TrackingEventType.SUBMITTED),
    )


@router.get("/failed", response_model=list[FailedRecipient])
def failed_recipients(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Empfaenger, die den Test nicht bestanden haben (geklickt oder Daten abgeschickt).

    Pro Empfaenger wird das schwerwiegendste Ereignis gezeigt (Daten abgeschickt
    schlaegt Klick), jeweils mit dem juengsten Zeitstempel.
    """
    rows = (
        db.query(
            Recipient.email,
            Recipient.first_name,
            Recipient.last_name,
            Campaign.id.label("campaign_id"),
            Campaign.name.label("campaign_name"),
            TrackingEvent.event_type,
            TrackingEvent.occurred_at,
        )
        .join(Campaign, Campaign.id == Recipient.campaign_id)
        .join(TrackingEvent, TrackingEvent.recipient_id == Recipient.id)
        .filter(TrackingEvent.event_type.in_([TrackingEventType.CLICKED, TrackingEventType.SUBMITTED]))
        .all()
    )

    severity = {TrackingEventType.CLICKED: 1, TrackingEventType.SUBMITTED: 2}
    best: dict[tuple[str, str], dict] = {}
    for email, first, last, camp_id, camp_name, event_type, occurred in rows:
        key = (email, str(camp_id))
        sev = severity[event_type]
        cur = best.get(key)
        if cur is None or sev > cur["sev"] or (sev == cur["sev"] and occurred > cur["occurred_at"]):
            best[key] = {
                "email": email,
                "first_name": first,
                "last_name": last,
                "campaign_id": camp_id,
                "campaign_name": camp_name,
                "status": "submitted" if event_type == TrackingEventType.SUBMITTED else "clicked",
                "occurred_at": occurred,
                "sev": sev,
            }

    result = sorted(best.values(), key=lambda r: (r["sev"], r["occurred_at"]), reverse=True)
    return [FailedRecipient(**{k: v for k, v in r.items() if k != "sev"}) for r in result]
