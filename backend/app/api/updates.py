# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Pruefung signierter Offline-Update-Bundles (Welle 8).

Bewusst **nur** Pruefung: Der Endpunkt sagt, ob ein Bundle echt und einspielbar
ist, spielt es aber nicht ein. Das Einspielen tauscht Quelltext aus und startet
den Stack neu - das gehoert auf die Kommandozeile des Betreibers
(``update.sh --bundle``), nicht hinter einen Klick im Webinterface, dessen
Fehlbedienung die Instanz waehrend einer laufenden Kampagne stilllegen wuerde.

Der Upload wird in eine temporaere Datei geschrieben und danach restlos
entfernt - ein Bundle ist mehrere MB gross und hat im Arbeitsspeicher des
Webprozesses nichts zu suchen.
"""
import logging
import os
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.permissions import require_admin
from app.database import get_db
from app.models import User
from app.services.audit import client_ip, record_audit
from app.services.update_bundle import (
    MAX_TOTAL_BYTES,
    BundleError,
    trusted_public_keys,
    verify_bundle,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/updates", tags=["updates"])

_CHUNK = 1024 * 1024


@router.get("/bundle/status")
def bundle_status(_: User = Depends(require_admin)) -> dict:
    """Ob ueberhaupt ein Signaturschluessel hinterlegt ist.

    Ohne Schluessel scheitert jede Pruefung - das soll die Oberflaeche sagen
    koennen, bevor jemand eine 200-MB-Datei hochlaedt.
    """
    try:
        keys = trusted_public_keys()
    except BundleError as exc:
        logger.warning("UPDATE_BUNDLE_PUBKEYS ist unbrauchbar: %s", exc.message)
        return {"keys_configured": 0, "code": exc.code}
    return {"keys_configured": len(keys), "code": None}


@router.post("/bundle/verify")
async def verify_upload(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> dict:
    tmp_path: str | None = None
    try:
        fd, tmp_path = tempfile.mkstemp(prefix="sentrymail-bundle-", suffix=".tar.gz")
        written = 0
        with os.fdopen(fd, "wb") as out:
            while chunk := await file.read(_CHUNK):
                written += len(chunk)
                if written > MAX_TOTAL_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Bundle ist groesser als {MAX_TOTAL_BYTES} Bytes.",
                    )
                out.write(chunk)

        try:
            info = verify_bundle(tmp_path)
        except BundleError as exc:
            # Nach aussen geht nur der Code. Die ausfuehrliche Begruendung nennt
            # Dateinamen, Serverpfade und Text fremder Ausnahmen - die gehoert ins
            # Log des Betreibers, nicht in eine HTTP-Antwort.
            logger.info("Offline-Update-Bundle abgelehnt (%s): %s", exc.code, exc.message)
            # Abgelehnte Bundles sind sicherheitsrelevant: Sie landen im Audit-Log,
            # damit ein Manipulationsversuch nachvollziehbar bleibt.
            record_audit(
                db,
                action="update.bundle.rejected",
                description=f"Offline-Update-Bundle abgelehnt: {exc.code}",
                actor=current_user,
                ip=client_ip(request),
            )
            return {"valid": False, "code": exc.code, "info": None}

        record_audit(
            db,
            action="update.bundle.verified",
            description=(
                f"Offline-Update-Bundle geprueft: Zielversion {info.target_version}, "
                f"Schluessel {info.key_id}, {info.file_count} Dateien"
            )[:512],
            actor=current_user,
            ip=client_ip(request),
        )
        return {"valid": True, "code": None, "info": info.as_dict()}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
