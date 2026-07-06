# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Reporting-/Auswertungslogik (Open Core).

Gemeinsam genutzt vom Dashboard (KPIs, Risiko, Zeitachse, Durchgefallene) und vom
Management Report. Die Risikobewertung ist bewusst regelbasiert (kein KI-Scoring
- das ist ein Enterprise-Feature): pro Empfaenger zaehlt das schwerwiegendste
Ereignis.
"""
from datetime import datetime, timezone

from sqlalchemy import Date, cast, func
from sqlalchemy.orm import Session

from app.models import Campaign, Recipient, TrackingEvent, TrackingEventType
from app.schemas import (
    ActivityHeatmap,
    BreakdownSlice,
    CampaignRisk,
    DashboardSummary,
    EngagementAnalytics,
    FailedRecipient,
    HeatmapCell,
    ManagementReport,
    ReportCampaignRow,
    RiskDistribution,
    RiskSummary,
    TimelinePoint,
)

_ENGAGED = [TrackingEventType.CLICKED, TrackingEventType.SUBMITTED]


def risk_points(types) -> int:
    """Punkte fuer das schwerwiegendste Ereignis eines Empfaengers."""
    if TrackingEventType.SUBMITTED in types:
        return 100
    if TrackingEventType.CLICKED in types:
        return 60
    if TrackingEventType.OPENED in types:
        return 20
    return 0


def risk_level(score: int) -> str:
    """Ampel-Stufe aus dem 0-100-Score."""
    if score >= 67:
        return "high"
    if score >= 34:
        return "medium"
    return "low"


def _band(points: int) -> str:
    return "high" if points == 100 else "medium" if points == 60 else "low" if points == 20 else "none"


def _rate(part: int, whole: int) -> int:
    return round(part / whole * 100) if whole else 0


def _events_by_recipient(db: Session) -> dict:
    types_by_recipient: dict = {}
    for recipient_id, event_type in db.query(TrackingEvent.recipient_id, TrackingEvent.event_type).all():
        types_by_recipient.setdefault(recipient_id, set()).add(event_type)
    return types_by_recipient


def overall_summary(db: Session) -> DashboardSummary:
    """KPI-Kennzahlen: eindeutige Empfaenger je Ereignistyp."""

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


def compute_risk(db: Session) -> RiskSummary:
    """Regelbasierter Risiko-Score (gesamt + je Kampagne + Verteilung)."""
    recipients = db.query(Recipient.id, Recipient.campaign_id).all()
    types_by_recipient = _events_by_recipient(db)

    dist = {"high": 0, "medium": 0, "low": 0, "none": 0}
    total_points = 0
    per_campaign_acc: dict = {}

    for recipient_id, campaign_id in recipients:
        pts = risk_points(types_by_recipient.get(recipient_id, ()))
        total_points += pts
        dist[_band(pts)] += 1
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
                level=risk_level(cscore),
            )
        )
    per_campaign.sort(key=lambda c: c.score, reverse=True)

    return RiskSummary(
        score=score,
        level=risk_level(score),
        recipients=total,
        distribution=RiskDistribution(**dist),
        per_campaign=per_campaign,
    )


def timeline(db: Session) -> list[TimelinePoint]:
    """Ereignisse pro Tag (geoeffnet/geklickt/abgeschickt)."""
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


def activity_heatmap(db: Session) -> ActivityHeatmap:
    """Ereignisse nach Wochentag (0=Mo..6=So) und Tagesstunde (0..23).

    Nutzt Postgres ``extract`` (isodow: 1=Mo..7=So). Nur belegte Zellen werden
    zurueckgegeben; das Frontend fuellt das 7x24-Raster selbst auf.
    """
    dow = func.extract("isodow", TrackingEvent.occurred_at)
    hour = func.extract("hour", TrackingEvent.occurred_at)
    rows = (
        db.query(dow.label("dow"), hour.label("hour"), func.count().label("count"))
        .group_by("dow", "hour")
        .all()
    )
    cells = [
        HeatmapCell(weekday=int(d) - 1, hour=int(h), count=int(c))
        for d, h, c in rows
    ]
    total = sum(cell.count for cell in cells)
    max_count = max((cell.count for cell in cells), default=0)
    return ActivityHeatmap(total_events=total, max_count=max_count, cells=cells)


def _breakdown(db: Session, column, *, drop_null: bool = False) -> list[BreakdownSlice]:
    """Zaehlt Interaktions-Events (Klick/Absenden) gruppiert nach ``column``.

    NULL-Werte werden als "Unbekannt" gebuendelt; mit ``drop_null`` (z. B. fuer
    UTM-Quellen) ganz ausgelassen. Absteigend nach Haeufigkeit sortiert.
    """
    query = db.query(column, func.count().label("count")).filter(
        TrackingEvent.event_type.in_(_ENGAGED)
    )
    if drop_null:
        query = query.filter(column.isnot(None))
    rows = query.group_by(column).all()
    slices = [BreakdownSlice(label=value or "Unbekannt", count=count) for value, count in rows]
    return sorted(slices, key=lambda s: s.count, reverse=True)


def engagement_analytics(db: Session) -> EngagementAnalytics:
    """Aufschluesselung der Interaktionen nach Browser, OS, Geraet und UTM-Quelle."""
    total = (
        db.query(func.count())
        .select_from(TrackingEvent)
        .filter(TrackingEvent.event_type.in_(_ENGAGED))
        .scalar()
        or 0
    )
    return EngagementAnalytics(
        total_events=total,
        browsers=_breakdown(db, TrackingEvent.browser),
        operating_systems=_breakdown(db, TrackingEvent.os),
        devices=_breakdown(db, TrackingEvent.device_type),
        countries=_breakdown(db, TrackingEvent.country, drop_null=True),
        languages=_breakdown(db, TrackingEvent.client_language, drop_null=True),
        resolutions=_breakdown(db, TrackingEvent.screen_resolution, drop_null=True),
        utm_sources=_breakdown(db, TrackingEvent.utm_source, drop_null=True),
    )


def failed_recipients(db: Session, limit: int | None = None) -> list[FailedRecipient]:
    """Empfaenger, die den Test nicht bestanden haben (geklickt/abgeschickt).

    Pro Empfaenger das schwerwiegendste Ereignis (abgeschickt schlaegt Klick),
    jeweils mit dem juengsten Zeitstempel. Optional auf ``limit`` gekuerzt.
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
    if limit is not None:
        result = result[:limit]
    return [FailedRecipient(**{k: v for k, v in r.items() if k != "sev"}) for r in result]


def management_report(db: Session) -> ManagementReport:
    """Konsolidierter Report: Gesamtkennzahlen, Raten, Risiko, Kampagnenvergleich,
    Top-Durchgefallene. Basis fuer Bildschirm-Ansicht und CSV-Export."""
    recipients = db.query(Recipient.id, Recipient.campaign_id, Recipient.sent_at).all()
    types_by_recipient = _events_by_recipient(db)
    campaign_names = dict(db.query(Campaign.id, Campaign.name).all())

    zero = lambda: {"recipients": 0, "sent": 0, "opened": 0, "clicked": 0, "submitted": 0, "points": 0}  # noqa: E731
    per_campaign: dict = {}
    tot = zero()
    dist = {"high": 0, "medium": 0, "low": 0, "none": 0}

    for recipient_id, campaign_id, sent_at in recipients:
        types = types_by_recipient.get(recipient_id, set())
        opened = TrackingEventType.OPENED in types
        clicked = TrackingEventType.CLICKED in types
        submitted = TrackingEventType.SUBMITTED in types
        sent = sent_at is not None or TrackingEventType.SENT in types
        pts = risk_points(types)
        dist[_band(pts)] += 1

        acc = per_campaign.setdefault(campaign_id, zero())
        for bucket, hit in (
            ("recipients", True),
            ("sent", sent),
            ("opened", opened),
            ("clicked", clicked),
            ("submitted", submitted),
        ):
            acc[bucket] += 1 if hit else 0
            tot[bucket] += 1 if hit else 0
        acc["points"] += pts
        tot["points"] += pts

    rows = []
    for campaign_id, a in per_campaign.items():
        cscore = round(a["points"] / a["recipients"]) if a["recipients"] else 0
        rows.append(
            ReportCampaignRow(
                campaign_id=campaign_id,
                name=campaign_names.get(campaign_id, "—"),
                recipients=a["recipients"],
                sent=a["sent"],
                opened=a["opened"],
                clicked=a["clicked"],
                submitted=a["submitted"],
                open_rate=_rate(a["opened"], a["recipients"]),
                click_rate=_rate(a["clicked"], a["recipients"]),
                submit_rate=_rate(a["submitted"], a["recipients"]),
                risk_score=cscore,
                risk_level=risk_level(cscore),
            )
        )
    rows.sort(key=lambda r: r.risk_score, reverse=True)

    n = tot["recipients"]
    score = round(tot["points"] / n) if n else 0

    return ManagementReport(
        generated_at=datetime.now(timezone.utc),
        campaigns_total=db.query(func.count(Campaign.id)).scalar() or 0,
        recipients=n,
        sent=tot["sent"],
        opened=tot["opened"],
        clicked=tot["clicked"],
        submitted=tot["submitted"],
        open_rate=_rate(tot["opened"], n),
        click_rate=_rate(tot["clicked"], n),
        submit_rate=_rate(tot["submitted"], n),
        risk_score=score,
        risk_level=risk_level(score),
        risk_distribution=RiskDistribution(**dist),
        campaign_rows=rows,
        top_failed=failed_recipients(db, limit=10),
    )
