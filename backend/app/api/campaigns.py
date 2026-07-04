"""CRUD- und Versand-Endpunkte fuer Kampagnen."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import Campaign, Recipient, User
from app.schemas import CampaignCreate, CampaignOut, CampaignUpdate
from app.services.campaign import send_campaign
from app.utils.security import generate_tracking_token

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=list[CampaignOut])
def list_campaigns(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Campaign).order_by(Campaign.created_at.desc()).all()


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = Campaign(
        name=payload.name,
        template_id=payload.template_id,
        scheduled_at=payload.scheduled_at,
        created_by_id=current_user.id,
    )
    db.add(campaign)
    db.flush()

    for recipient in payload.recipients:
        db.add(
            Recipient(
                campaign_id=campaign.id,
                email=recipient.email,
                first_name=recipient.first_name,
                last_name=recipient.last_name,
                tracking_token=generate_tracking_token(),
            )
        )

    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(campaign_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kampagne nicht gefunden")
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kampagne nicht gefunden")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(campaign_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kampagne nicht gefunden")
    db.delete(campaign)
    db.commit()


@router.post("/{campaign_id}/send")
async def trigger_campaign(campaign_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kampagne nicht gefunden")

    results = await send_campaign(db, campaign)
    return {"campaign_id": campaign_id, **results}
