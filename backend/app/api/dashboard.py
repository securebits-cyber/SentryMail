# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Aggregierte Uebersicht: KPIs, Risikobewertung, Zeitachse, Durchgefallene."""
from fastapi import APIRouter, Depends
from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import Campaign, Recipient, TrackingEvent, TrackingEventType, User
from app.schemas import (
    CampaignRisk,
    DashboardSummary,
    FailedRecipient,
    RiskDistribution,
    RiskSummary,
    TimelinePoint,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _risk_level(score: int) -> str:
    """Ampel-Stufe aus dem 0-100-Score (regelbasiert, kein KI-Scoring)."""
    if score >= 67:
        return "high"
    if score >= 34:
        return "medium"
    return "low"


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


@router.get("/risk", response_model=RiskSummary)
def risk(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Regelbasierte Risikobewertung: pro Empfaenger das schwerwiegendste Ereignis
    (abgeschickt=100, geklickt=60, geoeffnet=20, nichts=0). Score = Mittelwert."""
    recipients = db.query(Recipient.id, Recipient.campaign_id).all()
    events = db.query(TrackingEvent.recipient_id, TrackingEvent.event_type).all()

    types_by_recipient: dict = {}
    for recipient_id, event_type in events:
        types_by_recipient.setdefault(recipient_id, set()).add(event_type)

    def points_for(recipient_id) -> int:
        types = types_by_recipient.get(recipient_id, ())
        if TrackingEventType.SUBMITTED in types:
            return 100
        if TrackingEventType.CLICKED in types:
            return 60
        if TrackingEventType.OPENED in types:
            return 20
        return 0

    dist = {"high": 0, "medium": 0, "low": 0, "none": 0}
    total_points = 0
    per_campaign_acc: dict = {}  # campaign_id -> [summe_punkte, anzahl]

    for recipient_id, campaign_id in recipients:
        pts = points_for(recipient_id)
        total_points += pts
        band = "high" if pts == 100 else "medium" if pts == 60 else "low" if pts == 20 else "none"
        dist[band] += 1
        acc = per_campaign_acc.setdefault(campaign_id, [0, 0])
        acc[0] += pts
        acc[1] += 1

    total = len(recipients)
    score = round(total_points / total) if total else 0

    campaign_names = dict(db.query(Campaign.id, Campaign.name).all())
    per_campaign = []
    for campaign_id, (pts_sum, count) in per_campaign_acc.items():
        cscore = round(pts_sum / count) if count else 0
        per_campaign.append(
            CampaignRisk(
                campaign_id=campaign_id,
                name=campaign_names.get(campaign_id, "—"),
                recipients=count,
                score=cscore,
                level=_risk_level(cscore),
            )
        )
    per_campaign.sort(key=lambda c: c.score, reverse=True)

    return RiskSummary(
        score=score,
        level=_risk_level(score),
        recipients=total,
        distribution=RiskDistribution(**dist),
        per_campaign=per_campaign,
    )


@router.get("/timeline", response_model=list[TimelinePoint])
def timeline(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Ereignisse pro Tag (geoeffnet/geklickt/abgeschickt) fuer die Zeitachse."""
    day = cast(TrackingEvent.occurred_at, Date)
    rows = (
        db.query(day.label("day"), TrackingEvent.event_type, func.count().label("count"))
        .filter(
            TrackingEvent.event_type.in_(
                [TrackingEventType.OPENED, TrackingEventType.CLICKED, TrackingEventType.SUBMITTED]
            )
        )
        .group_by(day, TrackingEvent.event_type)
        .order_by(day)
        .all()
    )

    by_date: dict[str, dict] = {}
    for day_value, event_type, count in rows:
        point = by_date.setdefault(str(day_value), {"opened": 0, "clicked": 0, "submitted": 0})
        point[event_type.value] = count

    return [TimelinePoint(date=date, **counts) for date, counts in sorted(by_date.items())]
