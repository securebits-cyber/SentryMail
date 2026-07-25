# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Aufbewahrungsfrist und automatische Loeschung (Welle 2).

Geloescht werden die **personenbeziehbaren** Daten abgeschlossener Kampagnen,
nicht die Messwerte: E-Mail und Name des Empfaengers werden unwiederbringlich
ersetzt, IP, Fingerprint, Referrer, User-Agent und die clientseitig erfassten
Merkmale werden aus den Ereignissen entfernt. Die Ereigniszeilen selbst bleiben
stehen - wuerde man sie loeschen, waeren auch saemtliche Kampagnenkennzahlen
weg, und ein Awareness-Nachweis nach NIS2 liesse sich nicht mehr fuehren.
Uebrig bleibt eine anonyme Statistik: wie viele geklickt haben, aber nicht mehr,
wer.

Ohne gesetzte ``retention_days`` passiert **nichts**. Ungefragt Daten zu
loeschen waere schlimmer, als sie aufzubewahren - der Betreiber entscheidet.
"""
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Campaign, CampaignStatus, PrivacyConfig, Recipient, TrackingEvent, User
from app.services.audit import record_audit
from app.utils.singleton import get_or_create_singleton

logger = logging.getLogger(__name__)

#: Reservierte TLD (RFC 2606) - eine anonymisierte Adresse darf nie zustellbar sein.
ANONYMOUS_DOMAIN = "anonymisiert.invalid"

#: Nur abgeschlossene Vorgaenge werden anonymisiert. Eine laufende Kampagne
#: braucht ihre Empfaengerdaten noch, um ueberhaupt versenden zu koennen.
_FINISHED = (CampaignStatus.COMPLETED, CampaignStatus.CANCELLED)

#: Ereignisfelder, die eine Person identifizierbar machen oder sie
#: wiedererkennbar halten. Browser, Betriebssystem, Geraeteklasse, Land und die
#: UTM-Parameter bleiben: sie sind grob genug fuer die Auswertung und ohne
#: Personenbezug wertlos fuer eine Re-Identifikation.
_EVENT_FIELDS_TO_CLEAR = (
    "ip_address",
    "user_agent",
    "referrer",
    "accept_language",
    "screen_resolution",
    "client_language",
    "fingerprint",
)


@dataclass(frozen=True)
class RetentionStats:
    """Was ein Lauf anfassen wuerde bzw. angefasst hat."""

    campaigns: int = 0
    recipients: int = 0
    events: int = 0

    @property
    def empty(self) -> bool:
        return self.recipients == 0


def cutoff_for(retention_days: int, now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)) - timedelta(days=retention_days)


def _due_recipients(db: Session, cutoff: datetime) -> list[Recipient]:
    """Noch nicht anonymisierte Empfaenger abgeschlossener, alter Kampagnen."""
    return (
        db.query(Recipient)
        .join(Campaign, Campaign.id == Recipient.campaign_id)
        .filter(
            Campaign.status.in_(_FINISHED),
            Campaign.created_at < cutoff,
            Recipient.anonymized_at.is_(None),
        )
        .all()
    )


def preview(db: Session, now: datetime | None = None) -> RetentionStats:
    """Was der naechste Lauf treffen wuerde - veraendert nichts.

    Die Oberflaeche zeigt das an, bevor der Betreiber eine Frist erstmals
    setzt: eine Loeschregel, deren Wirkung man erst hinterher sieht, ist keine
    brauchbare Grundlage fuer eine Betriebsvereinbarung.
    """
    config: PrivacyConfig = get_or_create_singleton(db, PrivacyConfig)
    if config.retention_days is None:
        return RetentionStats()

    recipients = _due_recipients(db, cutoff_for(config.retention_days, now))
    if not recipients:
        return RetentionStats()
    recipient_ids = [r.id for r in recipients]
    events = (
        db.query(TrackingEvent).filter(TrackingEvent.recipient_id.in_(recipient_ids)).count()
    )
    return RetentionStats(
        campaigns=len({r.campaign_id for r in recipients}),
        recipients=len(recipients),
        events=events,
    )


def purge_expired(
    db: Session, actor: User | None = None, now: datetime | None = None
) -> RetentionStats:
    """Anonymisiert alle faelligen Empfaenger und ihre Ereignisse.

    Idempotent: ``Recipient.anonymized_at`` markiert erledigte Zeilen, ein
    zweiter Lauf findet sie nicht mehr.
    """
    config: PrivacyConfig = get_or_create_singleton(db, PrivacyConfig)
    if config.retention_days is None:
        return RetentionStats()

    moment = now or datetime.now(timezone.utc)
    recipients = _due_recipients(db, cutoff_for(config.retention_days, moment))
    config.retention_last_run_at = moment
    if not recipients:
        db.commit()
        return RetentionStats()

    recipient_ids = [r.id for r in recipients]
    events = db.query(TrackingEvent).filter(TrackingEvent.recipient_id.in_(recipient_ids)).all()
    for event in events:
        for field in _EVENT_FIELDS_TO_CLEAR:
            setattr(event, field, None)

    for recipient in recipients:
        # Kein Hash der Original-Adresse: der waere mit einer Adressliste
        # zurueckrechenbar und damit keine Anonymisierung.
        recipient.email = f"anonym-{uuid.uuid4().hex[:12]}@{ANONYMOUS_DOMAIN}"
        recipient.first_name = None
        recipient.last_name = None
        recipient.anonymized_at = moment

    stats = RetentionStats(
        campaigns=len({r.campaign_id for r in recipients}),
        recipients=len(recipients),
        events=len(events),
    )
    db.commit()

    record_audit(
        db,
        action="privacy.retention.purged",
        description=(
            f"Aufbewahrungsfrist ({config.retention_days} Tage): "
            f"{stats.recipients} Empfänger in {stats.campaigns} Kampagnen anonymisiert, "
            f"{stats.events} Ereignisse bereinigt"
        ),
        actor=actor,
        # Ohne Akteur laeuft der Hintergrund-Tick - im Log soll das erkennbar
        # sein und nicht wie eine anonyme Aktion aussehen.
        actor_email=None if actor else "system (automatisch)",
    )
    logger.info(
        "Retention: %d Empfaenger in %d Kampagnen anonymisiert (%d Ereignisse)",
        stats.recipients,
        stats.campaigns,
        stats.events,
    )
    return stats
