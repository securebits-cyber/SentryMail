"""Business-Logik fuer den Kampagnen-Versand."""
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Campaign, CampaignStatus, Recipient, TrackingEventType
from app.services.mail import send_campaign_messages
from app.services.tracking import record_event
from app.utils.crypto import decrypt

logger = logging.getLogger(__name__)
settings = get_settings()


def _smtp_params(campaign: Campaign) -> dict:
    """SMTP-Parameter aus dem Sending Profile der Kampagne, sonst globales .env."""
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
    return {
        "host": settings.SMTP_HOST,
        "port": settings.SMTP_PORT,
        "tls_mode": settings.SMTP_TLS_MODE,
        "validate_certs": settings.SMTP_VERIFY_SSL,
        "username": settings.SMTP_USERNAME,
        "password": settings.SMTP_PASSWORD,
        "from_email": settings.SMTP_FROM_EMAIL,
        "from_name": settings.SMTP_FROM_NAME,
    }


async def send_campaign(db: Session, campaign: Campaign) -> dict[str, int]:
    """Versendet eine Kampagne an alle noch nicht versendeten Empfaenger."""
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
        **_smtp_params(campaign),
        subject=campaign.template.subject,
        template_html=campaign.template.html_content,
        template_text=campaign.template.text_content,
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
