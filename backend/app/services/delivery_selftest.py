# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zustell-Selbsttest gegen ein Kanarienpostfach (Welle 9.1, Core).

Vor dem Kampagnenstart geht eine Probemail **ueber denselben Weg wie die
Kampagne** an ein eigenes Postfach. Ein Test ueber einen anderen Absender wuerde
genau das nicht pruefen, worum es geht - deshalb kommen die SMTP-Parameter aus
``campaign.smtp_params``.

Zwei Grundsaetze:

* **Ein Fehlschlag blockiert den Start nicht.** Er warnt. Die Entscheidung,
  trotzdem zu starten, bleibt beim Betreiber, der sein Gateway besser kennt
  als wir.
* **Ohne Kanarienpostfach entfaellt der Test kommentarlos.** Er ist eine Hilfe,
  keine Voraussetzung.

Die Bestaetigung laeuft ueber IMAP: Die Probemail traegt einen eindeutigen Token
im Betreff, nach dem im Postfach gesucht wird. Ohne IMAP-Konfiguration bleibt
der Test bei ``pending`` stehen - schon der gescheiterte **Versand** ist die
haelfte der Diagnose, dafuer braucht es kein Postfach.
"""
from __future__ import annotations

import imaplib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Campaign, DeliveryConfig, DeliverySelfTest
from app.services.campaign import smtp_params
from app.services.mail import send_simple_email
from app.utils.crypto import decrypt
from app.utils.singleton import get_or_create_singleton

logger = logging.getLogger(__name__)

#: Wie lange eine Probemail als "unterwegs" gilt, bevor sie als durchgefallen
#: zaehlt. Greylisting verzoegert regelmaessig um 5-15 Minuten - kuerzer wuerde
#: den haeufigsten Normalfall als Fehler melden.
PENDING_GRACE = timedelta(minutes=30)

#: Obergrenze fuer die IMAP-Antwort, damit ein grosses Postfach den Request
#: nicht ausbremst. Gesucht wird ohnehin gezielt nach dem Token.
IMAP_TIMEOUT_SECONDS = 15

SUBJECT_PREFIX = "SentryMail Zustelltest"


def get_config(db: Session) -> DeliveryConfig:
    return get_or_create_singleton(db, DeliveryConfig)


def is_configured(db: Session) -> bool:
    return bool(get_config(db).canary_address.strip())


def latest_for_campaign(db: Session, campaign_id) -> DeliverySelfTest | None:
    return (
        db.query(DeliverySelfTest)
        .filter(DeliverySelfTest.campaign_id == campaign_id)
        .order_by(DeliverySelfTest.sent_at.desc())
        .first()
    )


def _route_label(db: Session, campaign: Campaign) -> str:
    """Menschenlesbarer Schnappschuss des genutzten Absenderwegs."""
    if campaign.sending_profile is not None:
        return f"{campaign.sending_profile.name} ({campaign.sending_profile.host})"
    return "Globales Fallback-SMTP"


async def run_probe(db: Session, campaign: Campaign) -> DeliverySelfTest:
    """Versendet die Probemail. Legt in jedem Fall einen Datensatz an.

    Auch der gescheiterte Versand wird gespeichert: Die Fehlermeldung des
    SMTP-Servers ist der wertvollste Teil der Diagnose und darf nicht in einem
    Stacktrace verschwinden.
    """
    config = get_config(db)
    canary = config.canary_address.strip()
    if not canary:
        raise ValueError("Kein Kanarienpostfach konfiguriert")

    token = secrets.token_hex(8)
    record = DeliverySelfTest(
        campaign_id=campaign.id,
        token=token,
        status="pending",
        route=_route_label(db, campaign)[:255],
    )

    params = smtp_params(db, campaign)
    try:
        await send_simple_email(
            **params,
            to_email=canary,
            subject=f"{SUBJECT_PREFIX} [{token}]",
            text_body=(
                "Automatischer Zustelltest von SentryMail.\n"
                f"Kampagne: {campaign.name}\n"
                f"Kennung: {token}\n\n"
                "Diese Nachricht bestaetigt nur, dass der Versandweg funktioniert. "
                "Sie ist keine Phishing-Simulation und erfordert keine Reaktion.\n"
            ),
        )
    except Exception as exc:  # noqa: BLE001 - jede SMTP-Ursache ist hier ein Befund
        record.status = "failed"
        record.error = f"{type(exc).__name__}: {exc}"[:512]
        record.checked_at = datetime.now(timezone.utc)
        logger.info("Zustelltest fuer Kampagne %s gescheitert: %s", campaign.id, exc)

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _search_canary(config: DeliveryConfig, token: str) -> bool:
    """Sucht den Token im Kanarienpostfach. Wirft bei IMAP-Problemen."""
    password = decrypt(config.imap_password_encrypted) if config.imap_password_encrypted else ""
    cls = imaplib.IMAP4_SSL if config.imap_use_ssl else imaplib.IMAP4
    client = cls(config.imap_host, config.imap_port, timeout=IMAP_TIMEOUT_SECONDS)
    try:
        client.login(config.imap_username, password)
        client.select(config.imap_mailbox, readonly=True)
        # Gezielt nach dem Token suchen: Fremde Nachrichten im Postfach werden
        # dadurch nie gelesen, auch nicht versehentlich.
        status, data = client.search(None, "SUBJECT", f'"{token}"')
        if status != "OK":
            raise RuntimeError(f"IMAP-Suche fehlgeschlagen: {status}")
        return bool(data and data[0].split())
    finally:
        try:
            client.logout()
        except Exception as exc:  # noqa: BLE001 - Aufraeumen darf das Ergebnis nicht kippen
            logger.debug("IMAP-Logout fehlgeschlagen: %s", exc)


def poll(db: Session, record: DeliverySelfTest) -> DeliverySelfTest:
    """Prueft einen offenen Test gegen das Kanarienpostfach.

    Abgeschlossene Tests werden nicht erneut geprueft - das Ergebnis ist ein
    Befund zu einem Zeitpunkt, kein Live-Zustand.
    """
    if record.status != "pending":
        return record

    config = get_config(db)
    now = datetime.now(timezone.utc)

    if not config.imap_host.strip():
        # Ohne IMAP gibt es nichts zu pruefen. Der Test bleibt offen statt
        # faelschlich zu bestehen oder durchzufallen.
        return record

    try:
        found = _search_canary(config, record.token)
    except Exception as exc:  # noqa: BLE001 - IMAP-Ursachen sind hier ein Befund
        # Ein IMAP-Problem ist kein Zustellfehler: Der Test bleibt offen, der
        # Grund wird festgehalten. Alles andere wuerde ein funktionierendes
        # Gateway faelschlich anschwaerzen.
        record.error = f"IMAP: {type(exc).__name__}: {exc}"[:512]
        record.checked_at = now
        db.commit()
        logger.info("Kanarienpostfach nicht erreichbar: %s", exc)
        return record

    record.checked_at = now
    if found:
        record.status = "passed"
        record.detected_at = now
        record.error = None
    elif record.sent_at and now - record.sent_at > PENDING_GRACE:
        record.status = "failed"
        record.error = (
            "Die Probemail ist innerhalb der Frist nicht im Kanarienpostfach angekommen."
        )
    db.commit()
    db.refresh(record)
    return record
