# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""CRUD- und Versand-Endpunkte fuer Kampagnen."""
import uuid

from aiosmtplib.errors import SMTPException
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import Campaign, GroupMember, Recipient, User
from app.schemas import CampaignCreate, CampaignOut, CampaignUpdate
from app.services.campaign import SmtpNotConfiguredError, send_campaign
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
        sending_profile_id=payload.sending_profile_id,
        landing_page_id=payload.landing_page_id,
        scheduled_at=payload.scheduled_at,
        created_by_id=current_user.id,
    )
    db.add(campaign)
    db.flush()

    # Empfaenger aus den gewaehlten Gruppen + direkt uebergebene, dedupliziert per E-Mail.
    seen: set[str] = set()
    sources: list[tuple[str, str | None, str | None]] = []

    if payload.group_ids:
        members = db.query(GroupMember).filter(GroupMember.group_id.in_(payload.group_ids)).all()
        for m in members:
            sources.append((m.email, m.first_name, m.last_name))
    for r in payload.recipients:
        sources.append((r.email, r.first_name, r.last_name))

    for email, first_name, last_name in sources:
        key = email.lower()
        if key in seen:
            continue
        seen.add(key)
        db.add(
            Recipient(
                campaign_id=campaign.id,
                email=email,
                first_name=first_name,
                last_name=last_name,
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

    try:
        results = await send_campaign(db, campaign)
    except SmtpNotConfiguredError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except SMTPException as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"SMTP-Verbindung fehlgeschlagen: {e}",
        )
    return {"campaign_id": campaign_id, **results}
