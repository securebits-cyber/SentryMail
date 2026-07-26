# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Audit-Log-Endpunkt: Anmelde- und System-Aenderungsereignisse.

Lesbar fuer Admins **und** den Datenschutzbeauftragten: dessen Kontrollrolle
(Welle 2) ist ohne Einsicht in die protokollierten Freigaben und
Konfigurationsaenderungen wertlos.
"""
import io
import json
import zipfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.permissions import require_admin_or_privacy_officer
from app.database import get_db
from app.models import AuditEvent, User
from app.schemas import AuditEventList
from app.services import audit_chain
from app.version import APP_VERSION

_README = """# Nachweispaket / Evidence package

DE: Dieses Paket enthaelt das Audit-Log als Hash-Kette. Jeder Eintrag traegt den
Hash seines Vorgaengers; wer einen Eintrag aendert oder entfernt, bricht die
Kette ab dieser Stelle sichtbar.

Pruefen ohne SentryMail, ohne Datenbank und ohne Netz:

    python verify.py sentrymail-nachweis-<zeitstempel>.zip

Das Werkzeug liegt im Quellbaum unter `tools/sentrymail-verify/verify.py` und
kommt mit der Python-Standardbibliothek aus. Exit-Code 0 = Kette in Ordnung.

Eintraege mit `content_purged: true` sind Tombstones: Ihr Inhalt wurde wegen
einer Aufbewahrungsfrist geloescht. Hash und Verkettung bleiben pruefbar, der
Inhalts-Hash wird bei ihnen nicht nachgerechnet - er kann nicht mehr stimmen.

EN: This package contains the audit log as a hash chain. Every entry carries the
hash of its predecessor; changing or removing an entry breaks the chain visibly
from that point on.

Verify without SentryMail, without a database and without network access:

    python verify.py sentrymail-nachweis-<timestamp>.zip

The tool lives in the source tree at `tools/sentrymail-verify/verify.py` and uses
only the Python standard library. Exit code 0 means the chain is intact.

Entries with `content_purged: true` are tombstones: their content was deleted
under a retention policy. Hash and linkage stay verifiable; the content hash is
not recomputed for them, because it cannot match any more.
"""

router = APIRouter(prefix="/audit-events", tags=["audit"])


@router.get("", response_model=AuditEventList)
def list_audit_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_privacy_officer),
):
    query = db.query(AuditEvent).order_by(AuditEvent.created_at.desc())
    total = query.count()
    events = query.offset(offset).limit(limit).all()
    return AuditEventList(total=total, events=events)


@router.get("/chain")
def chain_status(
    db: Session = Depends(get_db), _: User = Depends(require_admin_or_privacy_officer)
) -> dict:
    """Zustand der Nachweiskette.

    Prueft dieselbe Logik wie das eigenstaendige Verifier-Werkzeug, damit ein
    Bruch sichtbar wird, ohne dass jemand ein Paket exportieren muss.
    """
    events = db.query(AuditEvent).order_by(AuditEvent.seq).all()
    problems = audit_chain.verify_chain(events)
    head = events[-1] if events else None
    return {
        "entries": len(events),
        "head_seq": head.seq if head else None,
        "head_hash": head.entry_hash if head else None,
        "intact": not problems,
        "problems": problems[:50],
    }


@router.get("/evidence-package")
def evidence_package(
    db: Session = Depends(get_db), _: User = Depends(require_admin_or_privacy_officer)
) -> StreamingResponse:
    """Exportiert die Kette als unabhaengig pruefbares Paket.

    Enthaelt die Eintraege, ein Manifest und eine Anleitung. Geprueft wird mit
    ``tools/sentrymail-verify/verify.py`` - ohne SentryMail, ohne Datenbank und
    ohne Netz. Ohne unabhaengige Pruefbarkeit ist "revisionssicher" nur ein Wort.
    """
    events = db.query(AuditEvent).order_by(AuditEvent.seq).all()
    head = events[-1] if events else None

    lines = []
    for event in events:
        lines.append(
            json.dumps(
                {
                    "seq": event.seq,
                    "created_at": event.created_at.astimezone(timezone.utc).strftime(
                        "%Y-%m-%dT%H:%M:%S.%f"
                    )
                    + "Z",
                    "actor_email": event.actor_email or "",
                    "actor_name": event.actor_name or "",
                    "category": event.category or "",
                    "action": event.action or "",
                    "description": event.description or "",
                    "ip": event.ip or "",
                    "prev_hash": event.prev_hash,
                    "entry_hash": event.entry_hash,
                    "content_purged": event.content_purged_at is not None,
                },
                sort_keys=True,
                separators=(",", ":"),
                ensure_ascii=False,
            )
        )

    manifest = {
        "format": 1,
        "canonical_version": audit_chain.CANONICAL_VERSION,
        "product": "sentrymail",
        "app_version": APP_VERSION,
        "exported_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z",
        "entries": len(events),
        "head_seq": head.seq if head else None,
        "head_hash": head.entry_hash if head else None,
        "genesis_hash": audit_chain.GENESIS_HASH,
        "algorithm": "sha256",
    }

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("events.jsonl", "\n".join(lines) + ("\n" if lines else ""))
        archive.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
        archive.writestr("README.md", _README)
    buffer.seek(0)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="sentrymail-nachweis-{stamp}.zip"'},
    )
