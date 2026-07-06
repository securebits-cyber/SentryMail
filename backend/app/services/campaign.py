# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Business-Logik fuer den Kampagnen-Versand."""
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Campaign, CampaignStatus, Recipient, TrackingEventType
from app.services.mail import send_campaign_messages
from app.services.smtp_config import get_or_create_smtp_config
from app.services.tracking import record_event
from app.utils.crypto import decrypt

logger = logging.getLogger(__name__)
settings = get_settings()


def _smtp_params(db: Session, campaign: Campaign) -> dict:
    """SMTP-Parameter aus dem Sending Profile der Kampagne, sonst globales Fallback-SMTP (DB)."""
    profile = campaign.sending_profile
    if profile is not None:
        return {
            "host": profile.host,
            "port": profile.port,
            "tls_mode": profile.tls_mode,
            "validate_certs": not profile.ignore_cert_errors,
            "username": profile.username,
            "password": decrypt(profile.password_encrypted) if profile.password_encrypted else None,
            "from_email": profile.from_email,
            "from_name": profile.from_name,
        }
    config = get_or_create_smtp_config(db)
    return {
        "host": config.host,
        "port": config.port,
        "tls_mode": config.tls_mode,
        "validate_certs": config.verify_ssl,
        "username": config.username or None,
        "password": decrypt(config.password_encrypted) if config.password_encrypted else None,
        "from_email": config.from_email,
        "from_name": config.from_name,
    }


class SmtpNotConfiguredError(Exception):
    """Kein gueltiges SMTP fuer den Versand hinterlegt (Profil oder Fallback)."""


async def send_campaign(db: Session, campaign: Campaign) -> dict[str, int]:
    """Versendet eine Kampagne an alle noch nicht versendeten Empfaenger."""
    smtp = _smtp_params(db, campaign)
    host = (smtp.get("host") or "").strip()
    # Ohne gueltigen Host wuerde _open_smtp mit einer ungefangenen Exception
    # abbrechen (500, nichts versendet). Vorher klar melden.
    if not host or host.endswith("example.com"):
        raise SmtpNotConfiguredError(
            "Kein gültiges SMTP konfiguriert. Wähle für die Kampagne ein Sending Profile "
            "oder richte das Fallback-SMTP unter Einstellungen → SMTP ein."
        )

    recipients = db.query(Recipient).filter(Recipient.campaign_id == campaign.id, Recipient.sent_at.is_(None)).all()

    recipient_payload = [
        {
            "email": r.email,
            "first_name": r.first_name,
            "last_name": r.last_name,
            "tracking_token": r.tracking_token,
        }
        for r in recipients
    ]

    base = f"https://{settings.APP_DOMAIN}/track"
    results = await send_campaign_messages(
        **smtp,
        subject=campaign.template.subject,
        template_html=campaign.template.html_content,
        template_text=campaign.template.text_content,
        attachments=campaign.template.attachments,
        recipients=recipient_payload,
        landing_url_base=f"{base}/landing",
        pixel_url_base=base,
    )

    now = datetime.now(timezone.utc)
    for recipient in recipients:
        recipient.sent_at = now
        record_event(db, recipient.tracking_token, TrackingEventType.SENT)

    campaign.status = CampaignStatus.COMPLETED
    db.commit()
    return results
