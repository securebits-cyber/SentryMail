# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Hash-Verkettung des Audit-Logs (Welle 9.3, Core).

Jeder Eintrag traegt den Hash seines Vorgaengers. Wer einen Eintrag
nachtraeglich aendert oder entfernt, bricht die Kette ab dieser Stelle
sichtbar. Das ist der Unterschied zwischen "revisionssicher" als Behauptung und
als pruefbarer Eigenschaft.

**Die kanonische Form ist der eigentliche Vertrag.** Sie muss byte-genau
reproduzierbar sein, sonst schlaegt der Verifier bei einwandfreien Daten an -
ein Fehler, der erst beim Kunden auffaellt und dort maximalen Schaden
anrichtet. Deshalb: feste Feldliste, sortierte Schluessel, keine Leerzeichen,
UTC in fester Aufloesung.

**Was bewusst nicht gehasht wird:** ``actor_id``. Der Fremdschluessel ist
ON DELETE SET NULL - ein geloeschtes Benutzerkonto wuerde die Kette rueckwirkend
zerreissen. Gehasht werden die Schnappschuesse ``actor_email`` und
``actor_name``, die genau dafuer existieren. Ebenso wenig gehasht wird die
``id``: Sie ist ein technischer Schluessel ohne Aussage ueber den Vorgang.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import AuditEvent

logger = logging.getLogger(__name__)

#: Vorgaenger des ersten Eintrags. 64 Nullen - erkennbar als Kettenanfang und
#: kein moeglicher SHA-256-Wert eines echten Eintrags.
GENESIS_HASH = "0" * 64

#: Kennung des Postgres-Advisory-Locks, das die Anhaenge serialisiert. Ein
#: beliebiger, aber fester Wert; er darf sich nie aendern.
CHAIN_LOCK_KEY = 0x53454E54  # "SENT"

#: Formatversion der kanonischen Form. Aendert sich die Feldliste oder die
#: Serialisierung, wird diese Zahl erhoeht - alte Eintraege bleiben dann mit
#: ihrer Version pruefbar, statt stillschweigend als gebrochen zu gelten.
CANONICAL_VERSION = 1


def canonical_bytes(
    *,
    seq: int,
    created_at: datetime,
    actor_email: str,
    actor_name: str,
    category: str,
    action: str,
    description: str,
    ip: str | None,
    prev_hash: str,
) -> bytes:
    """Die Bytes, ueber die gehasht wird.

    Sortierte Schluessel, keine Leerzeichen, UTC mit Mikrosekunden und festem
    ``Z``-Suffix. ``ensure_ascii=False`` mit UTF-8-Kodierung, damit Umlaute in
    Beschreibungen nicht von der Python-Version abhaengen.
    """
    payload = {
        "v": CANONICAL_VERSION,
        "seq": seq,
        "created_at": created_at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z",
        "actor_email": actor_email or "",
        "actor_name": actor_name or "",
        "category": category or "",
        "action": action or "",
        "description": description or "",
        "ip": ip or "",
        "prev_hash": prev_hash,
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def compute_hash(**fields) -> str:
    return hashlib.sha256(canonical_bytes(**fields)).hexdigest()


def hash_for_event(event: AuditEvent) -> str:
    """Hash eines vorhandenen Eintrags aus seinen gespeicherten Feldern."""
    return compute_hash(
        seq=event.seq,
        created_at=event.created_at,
        actor_email=event.actor_email,
        actor_name=event.actor_name,
        category=event.category,
        action=event.action,
        description=event.description,
        ip=event.ip,
        prev_hash=event.prev_hash,
    )


def lock_chain(db: Session) -> None:
    """Serialisiert das Anhaengen bis zum Ende der Transaktion.

    Ohne diese Sperre lesen zwei parallele Anhaenger denselben Vorgaenger und
    erzeugen zwei Eintraege mit gleichem ``prev_hash`` - die Kette gabelt sich,
    und der Verifier meldet einen Bruch, den niemand verursacht hat.

    Ein Advisory-Lock statt einer Sperrzeile: kein zusaetzlicher Datensatz, und
    er faellt beim Commit oder Rollback automatisch weg. ``record_audit``
    committet sofort, die Sperre wird also nur kurz gehalten.
    """
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": CHAIN_LOCK_KEY})


def chain_head(db: Session) -> AuditEvent | None:
    """Letzter Eintrag der Kette. Nur unter gehaltener Sperre aussagekraeftig."""
    return db.query(AuditEvent).order_by(AuditEvent.seq.desc()).first()


def prepare(db: Session, event: AuditEvent) -> AuditEvent:
    """Haengt ``event`` an die Kette an: setzt seq, prev_hash und entry_hash.

    Erwartet, dass die Sperre bereits gehalten wird.
    """
    head = chain_head(db)
    event.seq = (head.seq + 1) if head is not None else 1
    event.prev_hash = head.entry_hash if head is not None else GENESIS_HASH
    # Zeitstempel hier setzen statt der Datenbank zu ueberlassen: Der Wert geht
    # in den Hash ein und muss vor dem Schreiben feststehen.
    if event.created_at is None:
        event.created_at = datetime.now(timezone.utc)
    event.entry_hash = hash_for_event(event)
    return event


# --- Pruefung ---------------------------------------------------------------


def verify_chain(events: list[AuditEvent]) -> list[dict]:
    """Prueft eine nach ``seq`` sortierte Eintragsfolge.

    Gibt die Befunde zurueck - leere Liste heisst: Kette in Ordnung. Geprueft
    wird dieselbe Logik, die auch das eigenstaendige Verifier-Werkzeug nutzt;
    hier zusaetzlich, damit die Oberflaeche einen Bruch anzeigen kann, ohne
    dass jemand ein Paket exportiert.
    """
    problems: list[dict] = []
    expected_prev = GENESIS_HASH
    expected_seq: int | None = None

    for event in events:
        if expected_seq is not None and event.seq != expected_seq:
            problems.append(
                {"seq": event.seq, "code": "gap", "detail": f"erwartet {expected_seq}"}
            )
        if event.prev_hash != expected_prev:
            problems.append({"seq": event.seq, "code": "broken_link", "detail": ""})
        # Ein Tombstone kann seinen Inhalts-Hash nicht mehr bestaetigen - der
        # Inhalt ist weg. Die Verkettung bleibt trotzdem pruefbar.
        if event.content_purged_at is None and hash_for_event(event) != event.entry_hash:
            problems.append({"seq": event.seq, "code": "content_altered", "detail": ""})

        expected_prev = event.entry_hash
        expected_seq = event.seq + 1

    return problems


def purge_content(db: Session, cutoff: datetime) -> int:
    """Loescht die Inhalte aller Eintraege vor ``cutoff`` - Kette bleibt heil.

    **Die Konfliktregel der Welle 9.3:** Die Nachweiskette hebelt keine
    Loeschpflicht aus. Aufbewahrungsfristen haben Vorrang. Geloescht wird der
    Inhalt; ``seq``, ``prev_hash`` und ``entry_hash`` bleiben stehen, der
    Eintrag wird als Tombstone markiert.

    Dadurch bleibt beweisbar, **dass** und **wann** etwas geschah, ohne
    personenbezogene Daten ueber die Frist hinaus vorzuhalten - und die Kette
    bleibt lueckenlos pruefbar. Wuerde man die Zeilen loeschen, entstuende eine
    Luecke, die vom Verifier zu Recht als Bruch gemeldet wuerde.

    Idempotent: bereits geleerte Eintraege werden nicht erneut angefasst.
    """
    events = (
        db.query(AuditEvent)
        .filter(AuditEvent.created_at < cutoff, AuditEvent.content_purged_at.is_(None))
        .all()
    )
    now = datetime.now(timezone.utc)
    for event in events:
        event.actor_email = ""
        event.actor_name = ""
        event.description = ""
        event.ip = None
        event.content_purged_at = now
    return len(events)
