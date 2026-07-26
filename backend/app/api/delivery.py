# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zustellungs-Assistent: Allowlisting-Generator (Welle 9.1, Core).

Rein rechnend - kein Zustand, keine Migration. Der Assistent erzeugt aus den
Gateway-Profilen fertige Schnipsel bzw. Schrittfolgen, die der Mailadministrator
des Kunden umsetzt.

Die Vorbefuellung kommt aus der Instanz selbst (Absenderdomain aus dem
Fallback-SMTP, Tracking-Domain aus ``APP_DOMAIN``), damit niemand Werte
abschreiben muss, die das System bereits kennt.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user, require_admin
from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas import AllowlistRequest
from app.services.delivery_profiles import ProfileError, load_profiles, render
from app.services.smtp_config import get_or_create_smtp_config

router = APIRouter(prefix="/delivery", tags=["delivery"])


def _defaults(db: Session) -> dict[str, str]:
    """Was die Instanz ueber sich selbst weiss."""
    settings = get_settings()
    smtp = get_or_create_smtp_config(db)
    sender_domain = ""
    if smtp.from_email and "@" in smtp.from_email:
        sender_domain = smtp.from_email.rsplit("@", 1)[1].strip()
    return {
        "sender_domain": sender_domain,
        "sender_ips": "",  # kennt nur der Betreiber - je nach SMTP-Anbieter dessen Ausgangs-IP
        "tracking_domain": settings.APP_DOMAIN or "",
    }


@router.get("/gateways")
def list_gateways(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> dict:
    """Verfuegbare Gateway-Profile plus Vorbefuellung."""
    return {
        "gateways": [
            {
                "id": p["id"],
                "label": p["label"],
                "inputs": p.get("inputs", []),
                "vendor_docs": p.get("vendor_docs"),
            }
            for p in load_profiles()
        ],
        "defaults": _defaults(db),
    }


@router.post("/allowlist")
def build_allowlist(payload: AllowlistRequest, _: User = Depends(require_admin)) -> dict:
    """Rendert die Snippets eines Gateways.

    Admin-only: Die Ausgabe beschreibt, wie die Schutzwirkung des Mail-Gateways
    fuer einen Absender ausgesetzt wird - das ist keine Information fuer jeden
    angemeldeten Nutzer.
    """
    try:
        return render(payload.gateway, payload.inputs)
    except ProfileError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
