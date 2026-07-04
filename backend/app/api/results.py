"""Dashboard-/Ergebnis-Endpunkte inkl. CSV-Export."""
import csv
import io
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import Campaign, Recipient, TrackingEvent, User
from app.schemas import CampaignResultOut
from app.services.tracking import get_campaign_results

router = APIRouter(prefix="/results", tags=["results"])


@router.get("/{campaign_id}", response_model=CampaignResultOut)
def campaign_results(campaign_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kampagne nicht gefunden")
    return get_campaign_results(db, campaign_id)


@router.get("/{campaign_id}/export")
def export_campaign_csv(campaign_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kampagne nicht gefunden")

    recipients = db.query(Recipient).filter(Recipient.campaign_id == campaign_id).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["email", "first_name", "last_name", "sent_at", "events"])

    for recipient in recipients:
        events = (
            db.query(TrackingEvent.event_type)
            .filter(TrackingEvent.recipient_id == recipient.id)
            .order_by(TrackingEvent.occurred_at)
            .all()
        )
        event_summary = ",".join(e[0].value for e in events)
        writer.writerow([recipient.email, recipient.first_name, recipient.last_name, recipient.sent_at, event_summary])

    buffer.seek(0)
    filename = f"campaign_{campaign_id}_results.csv"
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
