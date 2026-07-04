"""Business-Logik fuer den Kampagnen-Versand."""
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Campaign, CampaignStatus, Recipient, TrackingEventType
from app.services.mail import smtp_client
from app.services.tracking import record_event

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_campaign(db: Session, campaign: Campaign) -> dict[str, int]:
    """Versendet eine Kampagne an alle noch nicht versendeten Empfaenger."""
    recipients = db.query(Recipient).filter(Recipient.campaign_id == campaign.id, Recipient.sent_at.is_(None)).all()

    recipient_payload = [
        {
            "email": r.email,
            "first_name": r.first_name,
            "tracking_token": r.tracking_token,
        }
        for r in recipients
    ]

    tracking_base_url = f"https://{settings.APP_DOMAIN}/track"
    results = await smtp_client.send_batch(
        campaign_id=str(campaign.id),
        recipients=recipient_payload,
        template_html=campaign.template.html_content,
        subject=campaign.template.subject,
        tracking_pixel_base_url=tracking_base_url,
    )

    now = datetime.now(timezone.utc)
    for recipient in recipients:
        recipient.sent_at = now
        record_event(db, recipient.tracking_token, TrackingEventType.SENT)

    campaign.status = CampaignStatus.COMPLETED
    db.commit()

    return results
