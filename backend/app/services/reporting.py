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

from sqlalchemy import Date, cast, distinct, func
from sqlalchemy.orm import Session

from app.models import Campaign, Recipient, TrackingEvent, TrackingEventType
from app.services import privacy
from app.services.campaign import UNDELIVERABLE_SUFFIX
from app.schemas import (
    ActivityHeatmap,
    BreakdownSlice,
    CampaignRisk,
    DashboardSummary,
    EngagementAnalytics,
    FailedRecipient,
    HeatmapCell,
    HumanRiskPerson,
    HumanRiskSummary,
    ManagementReport,
    ReportCampaignRow,
    RiskDistribution,
    RiskSummary,
    TimelinePoint,
)

_ENGAGED = [TrackingEventType.CLICKED, TrackingEventType.SUBMITTED]


def drop_campaign_ids(db: Session) -> set:
    """Kampagnen, die keine Mail versenden - erkennbar an den Empfaengerzeilen.

    Ein USB-Drop legt je Fundort eine Zeile an, deren Adresse auf ``.invalid``
    endet (RFC 2606, nie zustellbar). Wo **alle** Zeilen so aussehen, steht
    hinter keiner davon eine Person - dort sind es Datentraeger.

    Bewusst ueber dieses Merkmal und nicht ueber den Kanal: Der Kanal gehoert
    zum Enterprise-Add-on, und die Auswertung im Core darf davon nicht
    abhaengen. Die Adresse steht dagegen in der Core-Tabelle und sagt genau
    das, worauf es hier ankommt - dass niemand dahintersteht.
    """
    rows = db.query(Recipient.campaign_id, Recipient.email).all()
    seen: dict = {}
    for campaign_id, email in rows:
        placeholder = (email or "").lower().endswith(UNDELIVERABLE_SUFFIX)
        # Sobald eine echte Adresse dabei ist, ist es keine reine Drop-Kampagne.
        seen[campaign_id] = seen.get(campaign_id, True) and placeholder
    return {cid for cid, only_drops in seen.items() if only_drops}


def is_placeholder(email: str | None) -> bool:
    """Empfaengerzeile ohne Person dahinter (Fundort statt Postfach)."""
    return (email or "").lower().endswith(UNDELIVERABLE_SUFFIX)


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
        # "Abgeschickt" = Empfaenger mit gesetztem sent_at (Single Source of Truth,
        # deckt sich mit der Kampagnen-Ergebnisseite und dem Management-Report).
        sent=db.query(func.count(Recipient.id)).filter(Recipient.sent_at.isnot(None)).scalar() or 0,
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


# Kritikalitaets-Gewicht: eine kritische Person, die durchfaellt, ist ein
# hoeheres Geschaeftsrisiko als eine unkritische mit gleichem Klickverhalten.
_CRITICALITY_FACTOR = {"low": 0.9, "normal": 1.0, "high": 1.2}


def _is_fail(types) -> bool:
    return TrackingEventType.CLICKED in types or TrackingEventType.SUBMITTED in types


def human_risk(
    db: Session, top: int = 20, *, for_automation: bool = False, user=None
) -> HumanRiskSummary:
    """Personenbezogener Risiko-Score ueber alle Kampagnen (Human Risk Management).

    Aggregiert je Person (identifiziert per E-Mail) ihre Teilnahmen und bewertet
    nach den CLAUDE.MD-Kriterien:
    - Klickverhalten / Passworteingaben: schwerwiegendstes Ereignis je Kampagne,
      gemittelt (``behavior_score``).
    - Wiederholungsfehler: >= 2 Kampagnen mit Klick/Abgeschickt erhoehen den Score.
    - Kritikalitaet: gewichtet den Score (``_CRITICALITY_FACTOR``).
    - Abteilung / Funktion: als Attribute gefuehrt (Gruppierung/Anzeige).
    Trainingsfortschritt ist im Open Core nicht erfasst und geht nicht ein.

    Im Datenschutzmodus bleiben Gesamtscore und Verteilung erhalten, die
    namentliche Rangliste (``top_people``) entfaellt - sie ist der Prototyp
    einer Einzelpersonen-Auswertung.

    ``for_automation`` ist der einzige, bewusst benannte Ausweg: interne
    Automatik (z. B. die LMS-Zuweisung nach Risiko) braucht die Personenliste,
    zeigt sie aber niemandem an. Fuer alles, was ein Mensch zu sehen bekommt,
    bleibt der Default stehen.
    """
    types_by_recipient = _events_by_recipient(db)
    rows = db.query(
        Recipient.email,
        Recipient.first_name,
        Recipient.last_name,
        Recipient.department,
        Recipient.position,
        Recipient.criticality,
        Recipient.id,
    ).all()

    # Je Person sammeln: Punkte je Kampagne, Fails, beste bekannte Attribute.
    people: dict[str, dict] = {}
    for email, first, last, dept, pos, crit, rid in rows:
        key = email.lower()
        p = people.setdefault(
            key,
            {"email": email, "first": first, "last": last, "dept": dept,
             "pos": pos, "crit": crit, "points": [], "fails": 0},
        )
        # Attribute nachtragen, wenn in einer Teilnahme gepflegt.
        p["first"] = p["first"] or first
        p["last"] = p["last"] or last
        p["dept"] = p["dept"] or dept
        p["pos"] = p["pos"] or pos
        # Hoechste Kritikalitaet gewinnt.
        if crit and _CRITICALITY_FACTOR.get(crit, 1.0) > _CRITICALITY_FACTOR.get(p["crit"] or "normal", 1.0):
            p["crit"] = crit
        types = types_by_recipient.get(rid, set())
        p["points"].append(risk_points(types))
        if _is_fail(types):
            p["fails"] += 1

    dist = {"high": 0, "medium": 0, "low": 0, "none": 0}
    total_score = 0
    repeat_offenders = 0
    persons: list[HumanRiskPerson] = []

    for p in people.values():
        n = len(p["points"])
        behavior = round(sum(p["points"]) / n) if n else 0
        fails = p["fails"]
        repeat = fails >= 2
        if repeat:
            repeat_offenders += 1
        # Wiederholungsfehler-Zuschlag (max. +20), dann Kritikalitaets-Faktor.
        repeat_bonus = min(20, (fails - 1) * 10) if fails >= 2 else 0
        factor = _CRITICALITY_FACTOR.get(p["crit"] or "normal", 1.0)
        score = max(0, min(100, round((behavior + repeat_bonus) * factor)))
        total_score += score
        dist[_band_from_score(score)] += 1
        persons.append(
            HumanRiskPerson(
                email=p["email"],
                first_name=p["first"],
                last_name=p["last"],
                department=p["dept"],
                position=p["pos"],
                criticality=p["crit"],
                campaigns=n,
                fails=fails,
                repeat_offender=repeat,
                behavior_score=behavior,
                score=score,
                level=risk_level(score),
            )
        )

    persons.sort(key=lambda x: x.score, reverse=True)
    count = len(persons)
    overall = round(total_score / count) if count else 0
    locked = not for_automation and not privacy.individual_view_allowed(db, user)
    return HumanRiskSummary(
        score=overall,
        level=risk_level(overall),
        people=count,
        repeat_offenders=repeat_offenders,
        distribution=RiskDistribution(**dist),
        top_people=[] if locked else persons[:top],
        individuals_locked=locked,
    )


def _band_from_score(score: int) -> str:
    """Verteilungs-Band aus einem personenbezogenen Score (nicht Event-Punkte)."""
    if score == 0:
        return "none"
    if score >= 67:
        return "high"
    if score >= 34:
        return "medium"
    return "low"


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


def _breakdown(
    db: Session, column, *, drop_null: bool = False, pol: privacy.PrivacyPolicy | None = None
) -> list[BreakdownSlice]:
    """Zaehlt Interaktions-Events (Klick/Absenden) gruppiert nach ``column``.

    NULL-Werte werden als "Unbekannt" gebuendelt; mit ``drop_null`` (z. B. fuer
    UTM-Quellen) ganz ausgelassen. Absteigend nach Haeufigkeit sortiert.

    Im Datenschutzmodus wird jede Auspraegung unterdrueckt, hinter der weniger
    als k **Personen** stehen - eine seltene Sprache oder ein exotisches Land
    identifiziert sonst genau eine Person. Gezaehlt wird deshalb zusaetzlich
    ``distinct(recipient_id)``; die Ereigniszahl allein waere durch mehrfaches
    Klicken manipulierbar.
    """
    pol = pol or privacy.policy(db)
    query = db.query(
        column,
        func.count().label("count"),
        func.count(distinct(TrackingEvent.recipient_id)).label("persons"),
    ).filter(TrackingEvent.event_type.in_(_ENGAGED))
    if drop_null:
        query = query.filter(column.isnot(None))
    rows = query.group_by(column).all()
    slices = [
        BreakdownSlice(label=value or "Unbekannt", count=0, suppressed=True)
        if privacy.below_threshold(persons, pol)
        else BreakdownSlice(label=value or "Unbekannt", count=count)
        for value, count, persons in rows
    ]
    # Unterdrueckte Gruppen ans Ende, sonst stuenden sie mit count 0 vorn.
    return sorted(slices, key=lambda s: (not s.suppressed, s.count), reverse=True)


def engagement_analytics(db: Session) -> EngagementAnalytics:
    """Aufschluesselung der Interaktionen nach Browser, OS, Geraet und UTM-Quelle."""
    total = (
        db.query(func.count())
        .select_from(TrackingEvent)
        .filter(TrackingEvent.event_type.in_(_ENGAGED))
        .scalar()
        or 0
    )
    # Policy einmal lesen und durchreichen - sonst je Aufschluesselung ein Query.
    pol = privacy.policy(db)
    return EngagementAnalytics(
        total_events=total,
        browsers=_breakdown(db, TrackingEvent.browser, pol=pol),
        operating_systems=_breakdown(db, TrackingEvent.os, pol=pol),
        devices=_breakdown(db, TrackingEvent.device_type, pol=pol),
        countries=_breakdown(db, TrackingEvent.country, drop_null=True, pol=pol),
        languages=_breakdown(db, TrackingEvent.client_language, drop_null=True, pol=pol),
        resolutions=_breakdown(db, TrackingEvent.screen_resolution, drop_null=True, pol=pol),
        utm_sources=_breakdown(db, TrackingEvent.utm_source, drop_null=True, pol=pol),
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


def management_report(db: Session, user=None) -> ManagementReport:
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
        # Einheitliche "Abgeschickt"-Definition: allein sent_at (nicht das SENT-Event).
        sent = sent_at is not None
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

    pol = privacy.policy(db)
    individuals_locked = not privacy.individual_view_allowed(db, user)
    rows = []
    for campaign_id, a in per_campaign.items():
        cscore = round(a["points"] / a["recipients"]) if a["recipients"] else 0
        # Eine Kampagne mit weniger als k Empfaengern ist faktisch eine
        # Einzelpersonen-Auswertung: bei drei Adressaten verraet eine Klickrate
        # von 33 %, wer geklickt hat. Name und Empfaengerzahl bleiben stehen,
        # damit die Luecke im Report erkennbar ist.
        if privacy.below_threshold(a["recipients"], pol):
            rows.append(
                ReportCampaignRow(
                    campaign_id=campaign_id,
                    name=campaign_names.get(campaign_id, "—"),
                    recipients=a["recipients"],
                    sent=0, opened=0, clicked=0, submitted=0,
                    open_rate=0, click_rate=0, submit_rate=0,
                    risk_score=0,
                    risk_level=risk_level(0),
                    suppressed=True,
                )
            )
            continue
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
    rows.sort(key=lambda r: (not r.suppressed, r.risk_score), reverse=True)

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
        # Ueber ``individual_view_allowed``, nicht ueber das blosse Modus-Flag:
        # eine erteilte Vier-Augen-Freigabe (A3) muss hier greifen.
        top_failed=[] if individuals_locked else failed_recipients(db, limit=10),
        individuals_locked=individuals_locked,
    )
