# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Blast-Radius-Preflight: Regeln und Pruefungen (Welle 9.2, Core).

Vor dem Kampagnenstart soll niemand raten muessen, wen er gleich trifft und
wann. Dieses Modul haelt die Regeln dazu:

* **Ruhezeiten** - kein Versand ausserhalb der Arbeitszeit. Eine Simulation um
  drei Uhr nachts ist keine Awareness-Massnahme, sondern eine Stoerung.
* **Sperrfenster** - benannte Zeitraeume, in denen nichts startet.
* **Cooldown** - Mindestabstand je Person. Wer alle zwei Wochen getestet wird,
  lernt nichts dazu, sondern gewoehnt sich an Misstrauen.
* **Risikoklasse** - am Template gepflegt, ``high`` erzwingt eine Zweitfreigabe.

Die Klassifizierung der Koeder-Themen liegt als **Datendatei**
(``app/data/risk_themes.json``), nicht im Code: Welches Thema als heikel gilt,
entscheidet die Organisation, nicht das Produkt.

Zeitrechnung durchgaengig in der konfigurierten Zeitzone. Ruhezeiten in UTC zu
pruefen waere in jedem Land ausser einem falsch.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, time, timedelta
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import BlackoutWindow, PreflightConfig
from app.utils.singleton import get_or_create_singleton

logger = logging.getLogger(__name__)

THEMES_FILE = Path(__file__).resolve().parent.parent / "data" / "risk_themes.json"

RISK_CLASSES = ("low", "medium", "high")
APPROVAL_ROLES = ("admin", "privacy_officer")

#: Nur diese Klasse erzwingt eine Zweitfreigabe. Mittel und niedrig erscheinen
#: im Dialog, halten aber niemanden auf - sonst wird die Freigabe zur Formalie,
#: die man wegklickt, und verliert genau die Wirkung, um die es geht.
APPROVAL_REQUIRED_FOR = "high"


def get_config(db: Session) -> PreflightConfig:
    return get_or_create_singleton(db, PreflightConfig)


def resolve_timezone(name: str) -> ZoneInfo:
    """Zeitzone der Instanz. Faellt auf UTC zurueck statt zu scheitern.

    Eine unbekannte Zeitzone darf den Kampagnenstart nicht blockieren - sie ist
    ein Konfigurationsfehler, kein Sicherheitsproblem.
    """
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        logger.warning("Unbekannte Zeitzone %r, weiche auf UTC aus", name)
        return ZoneInfo("UTC")


def is_valid_timezone(name: str) -> bool:
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, KeyError):
        return False
    return True


@lru_cache(maxsize=1)
def risk_themes() -> list[dict]:
    """Themenvorschlaege je Risikoklasse. Leere Liste, wenn die Datei fehlt."""
    try:
        data = json.loads(THEMES_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        # Ohne Themenliste bleibt die Klassifizierung nutzbar, nur ohne
        # Vorschlaege - ein Datenfehler darf die Funktion nicht abschalten.
        logger.error("Risikothemen nicht lesbar: %s", exc)
        return []

    classes = data.get("classes") if isinstance(data, dict) else None
    if not isinstance(classes, list):
        logger.error("Risikothemen: 'classes' fehlt oder ist keine Liste")
        return []
    return classes


def reset_cache() -> None:
    risk_themes.cache_clear()


def in_quiet_hours(config: PreflightConfig, moment: datetime) -> bool:
    """Faellt ``moment`` in die Ruhezeiten?

    Ein Fenster ueber Mitternacht (22:00-06:00) ist der Normalfall und wird
    ausdruecklich unterstuetzt - die naive Variante ``start <= t < end`` waere
    dort immer falsch.
    """
    start, end = config.quiet_hours_start, config.quiet_hours_end
    if start is None or end is None or start == end:
        return False
    local = moment.astimezone(resolve_timezone(config.timezone)).timetz()
    current = time(local.hour, local.minute, local.second)
    if start < end:
        return start <= current < end
    return current >= start or current < end


def active_blackout(db: Session, moment: datetime) -> BlackoutWindow | None:
    """Das Sperrfenster, in das ``moment`` faellt - sonst ``None``."""
    return (
        db.query(BlackoutWindow)
        .filter(BlackoutWindow.starts_at <= moment, BlackoutWindow.ends_at > moment)
        .order_by(BlackoutWindow.starts_at)
        .first()
    )


def upcoming_blackouts(db: Session, moment: datetime, within: timedelta) -> list[BlackoutWindow]:
    """Sperrfenster, die bald beginnen - fuer den Hinweis im Dialog."""
    return (
        db.query(BlackoutWindow)
        .filter(BlackoutWindow.starts_at > moment, BlackoutWindow.starts_at <= moment + within)
        .order_by(BlackoutWindow.starts_at)
        .all()
    )


def requires_second_approval(risk_class: str) -> bool:
    return risk_class == APPROVAL_REQUIRED_FOR


# --- Auswertung vor dem Kampagnenstart --------------------------------------

#: Befund-Codes des Pflichtdialogs. Wie bei der Zustelldiagnose: Nach aussen
#: geht der Code, uebersetzt wird im Frontend.
SEVERITY_OK = "ok"
SEVERITY_INFO = "info"
SEVERITY_WARN = "warn"
SEVERITY_BLOCK = "block"


def _finding(code: str, severity: str, **params) -> dict:
    return {"code": code, "severity": severity, "params": params}


def excluded_group_ids(db: Session, campaign_id) -> list:
    from app.models import CampaignGroupExclusion

    return [
        row.group_id
        for row in db.query(CampaignGroupExclusion).filter(
            CampaignGroupExclusion.campaign_id == campaign_id
        )
    ]


def excluded_emails(db: Session, campaign_id) -> set[str]:
    """E-Mail-Adressen, die ueber eine ausgeschlossene Gruppe wegfallen.

    Der Ausschluss wirkt beim Versand, nicht durch Loeschen der Empfaenger:
    Wer eine Gruppe wieder einschliesst, soll seine Empfaengerliste nicht neu
    aufbauen muessen.
    """
    from app.models import GroupMember

    group_ids = excluded_group_ids(db, campaign_id)
    if not group_ids:
        return set()
    rows = db.query(GroupMember.email).filter(GroupMember.group_id.in_(group_ids)).all()
    return {email.lower() for (email,) in rows}


def affected_groups(db: Session, campaign_id) -> list[dict]:
    """Welche Gruppen die Kampagne trifft - abgeleitet ueber die Adressen.

    Die Kampagne materialisiert ihre Empfaenger beim Anlegen; eine dauerhafte
    Verknuepfung zur Gruppe gibt es nicht. Fuer den Dialog zaehlt aber, welche
    Gruppen betroffen sind, nicht welche einmal ausgewaehlt waren.
    """
    from app.models import Group, GroupMember, Recipient

    rows = (
        db.query(Group.id, Group.name, func.count(func.distinct(Recipient.id)))
        .join(GroupMember, GroupMember.group_id == Group.id)
        .join(Recipient, func.lower(Recipient.email) == func.lower(GroupMember.email))
        .filter(Recipient.campaign_id == campaign_id)
        .group_by(Group.id, Group.name)
        .order_by(Group.name)
        .all()
    )
    return [{"id": str(gid), "name": name, "recipients": count} for gid, name, count in rows]


def cooldown_violations(db: Session, campaign, cooldown_days: int, emails: set[str]) -> int:
    """Wie viele der Empfaenger in der Cooldown-Frist schon getestet wurden.

    Gezaehlt werden Personen, nicht Vorgaenge: Wer in drei alten Kampagnen war,
    ist trotzdem eine Person.
    """
    from app.models import Recipient

    if cooldown_days <= 0 or not emails:
        return 0
    since = datetime.now(tz=ZoneInfo("UTC")) - timedelta(days=cooldown_days)
    rows = (
        db.query(func.lower(Recipient.email))
        .filter(
            Recipient.campaign_id != campaign.id,
            Recipient.sent_at.is_not(None),
            Recipient.sent_at >= since,
        )
        .distinct()
        .all()
    )
    recent = {email for (email,) in rows}
    return len(emails & recent)


def evaluate(db, campaign) -> dict:
    """Vollstaendiger Befund fuer den Pflichtdialog vor dem Start."""
    from app.models import Recipient
    from app.services import delivery_selftest

    config = get_config(db)
    now = datetime.now(tz=ZoneInfo("UTC"))
    # Geprueft wird der geplante Startzeitpunkt, nicht "jetzt" - sonst meldet
    # der Dialog Ruhezeiten fuer den Moment des Hinsehens statt fuer den Versand.
    moment = campaign.scheduled_at or now

    all_emails = {
        email.lower()
        for (email,) in db.query(Recipient.email).filter(Recipient.campaign_id == campaign.id)
    }
    dropped = excluded_emails(db, campaign.id)
    effective = all_emails - dropped

    findings: list[dict] = []

    if not effective:
        findings.append(_finding("no_recipients", SEVERITY_BLOCK))

    if in_quiet_hours(config, moment):
        findings.append(
            _finding(
                "quiet_hours",
                SEVERITY_WARN,
                start=str(config.quiet_hours_start),
                end=str(config.quiet_hours_end),
                timezone=config.timezone,
            )
        )

    blackout = active_blackout(db, moment)
    if blackout is not None:
        findings.append(_finding("blackout_active", SEVERITY_WARN, label=blackout.label))
    for window in upcoming_blackouts(db, moment, timedelta(days=2)):
        findings.append(_finding("blackout_upcoming", SEVERITY_INFO, label=window.label))

    violations = cooldown_violations(db, campaign, config.cooldown_days, effective)
    if violations:
        findings.append(
            _finding("cooldown", SEVERITY_WARN, count=violations, days=config.cooldown_days)
        )

    risk_class = campaign.template.risk_class if campaign.template else "low"
    needs_approval = requires_second_approval(risk_class)
    if needs_approval:
        findings.append(
            _finding("high_risk", SEVERITY_WARN, role=config.second_approval_role)
        )

    approval = latest_approval(db, campaign.id)
    approval_ok = has_valid_approval(db, campaign)
    if needs_approval and not approval_ok:
        code = "approval_rejected" if (approval and approval.status.value == "rejected") else (
            "approval_pending" if approval else "approval_missing"
        )
        findings.append(_finding(code, SEVERITY_BLOCK, role=config.second_approval_role))

    selftest = delivery_selftest.latest_for_campaign(db, campaign.id)
    if selftest is not None and selftest.status == "failed":
        # Warnt, blockiert nicht - die Zusage aus Welle 9.1 gilt auch hier.
        findings.append(_finding("selftest_failed", SEVERITY_WARN))
    elif selftest is None and delivery_selftest.is_configured(db):
        findings.append(_finding("selftest_missing", SEVERITY_INFO))

    return {
        "campaign_id": str(campaign.id),
        "recipients_total": len(all_emails),
        "recipients_excluded": len(all_emails & dropped),
        "recipients_effective": len(effective),
        "groups": affected_groups(db, campaign.id),
        "excluded_group_ids": [str(g) for g in excluded_group_ids(db, campaign.id)],
        "send_window": campaign.scheduled_at.isoformat() if campaign.scheduled_at else None,
        "risk_class": risk_class,
        "requires_second_approval": needs_approval,
        "second_approval_role": config.second_approval_role,
        "cooldown_days": config.cooldown_days,
        "selftest_status": selftest.status if selftest is not None else None,
        "approval_status": approval.status.value if approval is not None else None,
        "approval_granted": approval_ok,
        "acknowledged_at": campaign.preflight_ack_at.isoformat() if campaign.preflight_ack_at else None,
        "findings": findings,
        # Nur ein harter Befund haelt den Start auf. Warnungen sind Warnungen -
        # die Entscheidung bleibt beim Betreiber.
        "blocked": any(f["severity"] == SEVERITY_BLOCK for f in findings),
    }


# --- Zweitfreigabe ----------------------------------------------------------


def latest_approval(db: Session, campaign_id):
    """Der zuletzt gestellte Freigabeantrag - oder ``None``."""
    from app.models import CampaignApproval

    return (
        db.query(CampaignApproval)
        .filter(CampaignApproval.campaign_id == campaign_id)
        .order_by(CampaignApproval.created_at.desc())
        .first()
    )


def has_valid_approval(db: Session, campaign) -> bool:
    """Liegt eine erteilte Freigabe vor?

    Ohne erforderliche Zweitfreigabe ist die Antwort immer ``True`` - sonst
    muesste jede harmlose Kampagne durch ein Verfahren, das fuer sie nicht
    gedacht ist.
    """
    from app.models import CampaignApprovalStatus

    risk_class = campaign.template.risk_class if campaign.template else "low"
    if not requires_second_approval(risk_class):
        return True
    approval = latest_approval(db, campaign.id)
    return approval is not None and approval.status == CampaignApprovalStatus.APPROVED


def may_decide(user, config: PreflightConfig) -> bool:
    """Darf dieser Nutzer eine Zweitfreigabe entscheiden?"""
    return user.role.value == config.second_approval_role
