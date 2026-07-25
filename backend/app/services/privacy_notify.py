# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Benachrichtigungen zum Vier-Augen-Verfahren (Welle 2).

Ein Freigabeverfahren, von dem der Entscheider erst beim naechsten Login
erfaehrt, taugt im Vorfallsfall nichts - deshalb geht bei jedem Antrag eine
Mail an alle aktiven Datenschutzbeauftragten, und der Antragsteller erfaehrt
die Entscheidung ebenfalls per Mail.

**Best effort und im Hintergrund:** Die Funktionen hier laufen als FastAPI-
BackgroundTask, also erst nach der Antwort, und oeffnen dafuer eine eigene
DB-Session - die des Requests ist dann bereits geschlossen. Wuerde direkt im
Request gesendet, haengt jeder Freigabeantrag am SMTP-Timeout, wenn der
Mailserver langsam oder nicht erreichbar ist. Fehler werden protokolliert und
nie nach oben gereicht: ein toter Mailserver darf weder einen Antrag noch eine
Freigabe verhindern.

Die Texte sind zweisprachig (DE/EN) in einer Mail: die Anwendung kennt keine
Sprachpraeferenz je Konto, und eine falsch geratene Sprache ist schlechter als
beide.
"""
import asyncio
import logging
import uuid

from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import Campaign, PrivacyUnlockRequest, User, UserRole
from app.services.mail import send_simple_email
from app.services.smtp_config import get_or_create_smtp_config
from app.utils.crypto import decrypt

logger = logging.getLogger(__name__)

_PRODUCT = "SentryMail"


def _settings_url() -> str:
    return f"https://{get_settings().APP_DOMAIN}/settings/privacy"


def _scope(db: Session, row: PrivacyUnlockRequest) -> tuple[str, str]:
    """Geltungsbereich als (deutsch, englisch)."""
    if row.campaign_id is None:
        return "alle Kampagnen", "all campaigns"
    campaign = db.get(Campaign, row.campaign_id)
    name = campaign.name if campaign else str(row.campaign_id)
    return f"Kampagne „{name}“", f'campaign "{name}"'


def _send(db: Session, to_email: str, subject: str, body: str) -> None:
    cfg = get_or_create_smtp_config(db)
    if not cfg.host:
        logger.info("Keine Benachrichtigung an %s: kein SMTP konfiguriert", to_email)
        return
    password = decrypt(cfg.password_encrypted) if cfg.password_encrypted else None
    try:
        asyncio.run(
            send_simple_email(
                host=cfg.host,
                port=cfg.port,
                tls_mode=cfg.tls_mode,
                validate_certs=cfg.verify_ssl,
                username=cfg.username or None,
                password=password,
                from_email=cfg.from_email,
                from_name=cfg.from_name or _PRODUCT,
                to_email=to_email,
                subject=subject,
                text_body=body,
            )
        )
    except Exception as e:  # noqa: BLE001 - Versand darf den Vorgang nie abbrechen
        logger.error("Benachrichtigung an %s fehlgeschlagen: %s", to_email, e)


def notify_officers_of_request(request_id: uuid.UUID) -> int:
    """Informiert alle aktiven Datenschutzbeauftragten. Gibt die Anzahl zurueck.

    Nimmt bewusst nur die ID entgegen: als BackgroundTask laeuft die Funktion
    nach dem Schliessen der Request-Session.
    """
    db = SessionLocal()
    try:
        return _notify_officers(db, request_id)
    finally:
        db.close()


def _notify_officers(db: Session, request_id: uuid.UUID) -> int:
    row = db.get(PrivacyUnlockRequest, request_id)
    if row is None:
        return 0
    officers = (
        db.query(User)
        .filter(User.role == UserRole.PRIVACY_OFFICER, User.is_active.is_(True))
        .all()
    )
    if not officers:
        # Kein Fehler: die Oberflaeche warnt bereits sichtbar, dass niemand
        # entscheiden kann.
        logger.warning("Freigabeantrag ohne Datenschutzbeauftragten - niemand benachrichtigt")
        return 0

    scope_de, scope_en = _scope(db, row)
    subject = f"[{_PRODUCT}] Freigabe beantragt / Unlock requested"
    body = (
        "Es liegt ein Antrag auf Aufhebung der Einzelpersonen-Sperre vor.\n\n"
        f"Antragsteller: {row.requested_by_email}\n"
        f"Geltungsbereich: {scope_de}\n"
        f"Dauer: {row.duration_hours} Stunden\n"
        f"Begruendung: {row.reason}\n\n"
        f"Entscheiden koennen Sie hier: {_settings_url()}\n"
        "Ohne Ihre Entscheidung bleibt der Antrag offen; es wird nichts freigegeben.\n\n"
        "---\n\n"
        "A request to lift the individual-person lock has been submitted.\n\n"
        f"Requested by: {row.requested_by_email}\n"
        f"Scope: {scope_en}\n"
        f"Duration: {row.duration_hours} hours\n"
        f"Reason: {row.reason}\n\n"
        f"You can decide here: {_settings_url()}\n"
        "Without your decision the request stays open; nothing is unlocked.\n"
    )
    for officer in officers:
        _send(db, officer.email, subject, body)
    return len(officers)


def notify_requester_of_decision(request_id: uuid.UUID, approved: bool) -> None:
    """Informiert den Antragsteller ueber die Entscheidung (BackgroundTask)."""
    db = SessionLocal()
    try:
        row = db.get(PrivacyUnlockRequest, request_id)
        if row is not None:
            _notify_requester(db, row, approved=approved)
    finally:
        db.close()


def _notify_requester(db: Session, row: PrivacyUnlockRequest, *, approved: bool) -> None:
    scope_de, scope_en = _scope(db, row)
    if approved:
        until = row.expires_at.strftime("%Y-%m-%d %H:%M UTC") if row.expires_at else "-"
        subject = f"[{_PRODUCT}] Freigabe erteilt / Unlock approved"
        body = (
            f"Ihr Antrag wurde von {row.decided_by_email} freigegeben.\n\n"
            f"Geltungsbereich: {scope_de}\n"
            f"Gueltig bis: {until}\n\n"
            "Danach greift die Sperre automatisch wieder.\n\n"
            "---\n\n"
            f"Your request was approved by {row.decided_by_email}.\n\n"
            f"Scope: {scope_en}\n"
            f"Valid until: {until}\n\n"
            "After that the lock applies again automatically.\n"
        )
    else:
        subject = f"[{_PRODUCT}] Freigabe abgelehnt / Unlock rejected"
        body = (
            f"Ihr Antrag wurde von {row.decided_by_email} abgelehnt.\n\n"
            f"Geltungsbereich: {scope_de}\n\n"
            "Die Einzelpersonen-Sperre bleibt bestehen.\n\n"
            "---\n\n"
            f"Your request was rejected by {row.decided_by_email}.\n\n"
            f"Scope: {scope_en}\n\n"
            "The individual-person lock remains in place.\n"
        )
    _send(db, row.requested_by_email, subject, body)
