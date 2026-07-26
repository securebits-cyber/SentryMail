# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zustellungs-Assistent (Welle 9.1, Core).

Drei Bausteine gegen den groessten Supportkostentreiber der ersten zwei Wochen
beim Kunden - das Mail-Gateway vor der Instanz:

* **Allowlisting-Generator** - erzeugt aus pflegbaren Gateway-Profilen fertige
  Schnipsel bzw. Schrittfolgen fuer den Mailadministrator des Kunden.
* **Zustell-Selbsttest** - Probemail ueber den Weg der Kampagne an ein
  Kanarienpostfach. Warnt, blockiert nie.
* **Diagnose** - warum eine Mail nicht ankam: SPF/DKIM/DMARC der
  Absenderdomain, Bounce-Auswertung, Greylisting-Erkennung.

Die Vorbefuellung kommt aus der Instanz selbst (Absenderdomain aus dem
Fallback-SMTP, Tracking-Domain aus ``APP_DOMAIN``), damit niemand Werte
abschreiben muss, die das System bereits kennt.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.permissions import require_admin
from app.config import get_settings
from app.database import get_db
from app.models import Campaign, DeliverySelfTest, User
from app.schemas import (
    AllowlistRequest,
    DeliveryConfigOut,
    DeliveryConfigUpdate,
    DeliverySelfTestOut,
)
from app.services import delivery_selftest as selftest
from app.services.audit import client_ip, record_audit
from app.services.delivery_diag import diagnose
from app.services.delivery_profiles import ProfileError, load_profiles, render
from app.services.smtp_config import get_or_create_smtp_config
from app.utils.crypto import encrypt

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
def list_gateways(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    """Verfuegbare Gateway-Profile plus Vorbefuellung.

    Admin-only wie der Rest des Assistenten: Ohne das ebenfalls admin-only
    ``/allowlist`` ist die Liste fuer andere Nutzer ohnehin ohne Zweck, und die
    Vorbefuellung nennt die Absenderdomain der Instanz.
    """
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


# --- Zustell-Selbsttest (Kanarienpostfach) ----------------------------------


def _config_out(config) -> DeliveryConfigOut:
    return DeliveryConfigOut(
        canary_address=config.canary_address,
        imap_host=config.imap_host,
        imap_port=config.imap_port,
        imap_username=config.imap_username,
        has_imap_password=bool(config.imap_password_encrypted),
        imap_use_ssl=config.imap_use_ssl,
        imap_mailbox=config.imap_mailbox,
    )


@router.get("/config", response_model=DeliveryConfigOut)
def read_config(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> DeliveryConfigOut:
    return _config_out(selftest.get_config(db))


@router.put("/config", response_model=DeliveryConfigOut)
def update_config(
    payload: DeliveryConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> DeliveryConfigOut:
    config = selftest.get_config(db)
    config.canary_address = payload.canary_address.strip()
    config.imap_host = payload.imap_host.strip()
    config.imap_port = payload.imap_port
    config.imap_username = payload.imap_username.strip()
    config.imap_use_ssl = payload.imap_use_ssl
    config.imap_mailbox = payload.imap_mailbox.strip() or "INBOX"
    # None = unveraendert, "" = loeschen. Sonst verliert jedes Speichern der
    # Seite das Passwort, weil das Frontend es nie zurueckbekommt.
    if payload.imap_password is not None:
        config.imap_password_encrypted = encrypt(payload.imap_password) if payload.imap_password else None

    record_audit(
        db,
        action="settings.delivery.updated",
        description=f"Kanarienpostfach: {config.canary_address or 'nicht gesetzt'}"[:512],
        actor=current_user,
        ip=client_ip(request),
    )
    db.commit()
    db.refresh(config)
    return _config_out(config)


def _campaign_or_404(db: Session, campaign_id: uuid.UUID) -> Campaign:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kampagne nicht gefunden")
    return campaign


@router.post("/selftest/{campaign_id}", response_model=DeliverySelfTestOut)
async def start_selftest(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> DeliverySelfTest:
    """Schickt eine Probemail ueber den Weg der Kampagne an das Kanarienpostfach."""
    campaign = _campaign_or_404(db, campaign_id)
    if not selftest.is_configured(db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Kein Kanarienpostfach konfiguriert.",
        )
    return await selftest.run_probe(db, campaign)


@router.get("/selftest/{campaign_id}", response_model=DeliverySelfTestOut | None)
def read_selftest(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> DeliverySelfTest | None:
    """Letztes Ergebnis. Ein noch offener Test wird dabei nachgeprueft.

    Admin-only wie die uebrigen Zustellungs-Endpunkte: Die Antwort nennt den
    Versandweg und ggf. SMTP-/IMAP-Fehlertexte - interne Infrastruktur, die
    nicht jeder angemeldete Nutzer sehen muss. Ausserdem loest der Aufruf ein
    IMAP-Polling aus.
    """
    _campaign_or_404(db, campaign_id)
    record = selftest.latest_for_campaign(db, campaign_id)
    if record is None:
        return None
    return selftest.poll(db, record)


@router.get("/diagnosis/{campaign_id}")
def read_diagnosis(
    campaign_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    """Diagnose "Warum kam die Mail nicht an".

    Wertet Zustellstatus und die DNS-Eintraege der Absenderdomain aus. Das ist
    eine Zustellungs-, keine Personenauswertung - die k-Anonymitaetsschwelle aus
    Welle 2 greift hier deshalb nicht.
    """
    campaign = _campaign_or_404(db, campaign_id)
    return diagnose(db, campaign)
