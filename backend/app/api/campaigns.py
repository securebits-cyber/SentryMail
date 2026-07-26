# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""CRUD- und Versand-Endpunkte fuer Kampagnen."""
import uuid
from datetime import datetime, timezone

from aiosmtplib.errors import SMTPException
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import (
    Campaign,
    CampaignApproval,
    CampaignApprovalStatus,
    CampaignGroupExclusion,
    Group,
    GroupMember,
    Recipient,
    User,
)
from app.schemas import (
    CampaignApprovalCreate,
    CampaignApprovalDecision,
    CampaignApprovalOut,
    CampaignCreate,
    CampaignExclusions,
    CampaignOut,
    CampaignUpdate,
    RecipientCreate,
)
from app.services import preflight
from app.services.audit import client_ip, record_audit
from app.services.campaign import SmtpNotConfiguredError, send_campaign
from app.utils.security import generate_tracking_token

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _get_or_404(db: Session, campaign_id: uuid.UUID) -> Campaign:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kampagne nicht gefunden")
    return campaign


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
    # Person-Attribute (Funktion/Abteilung/Kritikalitaet/Leitungsorgan) werden als Schnappschuss
    # uebernommen, damit Abteilungsvergleich und Human Risk Management je Kampagne greifen.
    seen: set[str] = set()
    sources: list[GroupMember | RecipientCreate] = []

    if payload.group_ids:
        sources.extend(db.query(GroupMember).filter(GroupMember.group_id.in_(payload.group_ids)).all())
    sources.extend(payload.recipients)

    for src in sources:
        key = src.email.lower()
        if key in seen:
            continue
        seen.add(key)
        db.add(
            Recipient(
                campaign_id=campaign.id,
                email=src.email,
                first_name=src.first_name,
                last_name=src.last_name,
                position=src.position,
                department=src.department,
                criticality=src.criticality,
                is_management=getattr(src, "is_management", False),
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
    campaign = _get_or_404(db, campaign_id)

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(campaign, field, value)
    # Eine geaenderte Kampagne ist eine andere Kampagne: Vorlage, Zeitpunkt oder
    # Versandweg koennen sich geaendert haben. Die alte Bestaetigung galt fuer
    # einen Stand, den niemand mehr sieht - also faellt sie weg (Welle 9.2).
    if changes:
        campaign.preflight_ack_at = None
        campaign.preflight_ack_by_id = None
    # Eine andere Vorlage ist ein anderer Koeder - moeglicherweise mit anderer
    # Risikoklasse. Eine Freigabe, die fuer einen anderen Text erteilt wurde,
    # traegt hier nicht mehr. Eine reine Umbenennung laesst sie dagegen stehen.
    if "template_id" in changes:
        db.query(CampaignApproval).filter(
            CampaignApproval.campaign_id == campaign_id,
            CampaignApproval.status == CampaignApprovalStatus.APPROVED,
        ).update({"status": CampaignApprovalStatus.REJECTED, "note": "Vorlage gewechselt"},
                 synchronize_session=False)
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
    campaign = _get_or_404(db, campaign_id)
    # Ohne bestaetigten Preflight startet nichts (Welle 9.2). Der Sinn des
    # Dialogs ist, dass jemand hingesehen hat - das laesst sich nicht
    # nachtraeglich herstellen, also blockiert der Versand hier.
    if campaign.preflight_ack_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Preflight nicht bestaetigt. Bitte zuerst den Startdialog durchlaufen.",
        )
    # Zweite Absicherung neben der Bestaetigung: Die Risikoklasse haengt an der
    # Vorlage und kann sich nach der Bestaetigung geaendert haben.
    if not preflight.has_valid_approval(db, campaign):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Hohe Risikoklasse: Es fehlt die Zweitfreigabe.",
        )

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


# --- Blast-Radius-Preflight (Welle 9.2) -------------------------------------


@router.get("/{campaign_id}/preflight")
def campaign_preflight(
    campaign_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> dict:
    """Was der Pflichtdialog vor dem Start zeigt.

    Reine Auswertung - veraendert nichts. Wer eine Kampagne startet, soll
    vorher gesehen haben, wen er trifft und wann.
    """
    return preflight.evaluate(db, _get_or_404(db, campaign_id))


@router.post("/{campaign_id}/preflight/ack")
def acknowledge_preflight(
    campaign_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Bestaetigt den Preflight. Ohne diese Bestaetigung startet nichts."""
    campaign = _get_or_404(db, campaign_id)
    result = preflight.evaluate(db, campaign)
    if result["blocked"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Der Preflight enthaelt einen blockierenden Befund.",
        )
    campaign.preflight_ack_at = datetime.now(timezone.utc)
    campaign.preflight_ack_by_id = current_user.id
    record_audit(
        db,
        action="campaign.preflight.acknowledged",
        description=(
            f"Kampagne '{campaign.name}': {result['recipients_effective']} Empfaenger, "
            f"Risikoklasse {result['risk_class']}"
        )[:512],
        actor=current_user,
        ip=client_ip(request),
    )
    db.commit()
    return preflight.evaluate(db, campaign)


@router.get("/{campaign_id}/exclusions", response_model=list[uuid.UUID])
def list_exclusions(
    campaign_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> list[uuid.UUID]:
    _get_or_404(db, campaign_id)
    return preflight.excluded_group_ids(db, campaign_id)


@router.put("/{campaign_id}/exclusions", response_model=list[uuid.UUID])
def set_exclusions(
    campaign_id: uuid.UUID,
    payload: CampaignExclusions,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[uuid.UUID]:
    """Setzt die ausgeschlossenen Gruppen.

    Ausgeschlossen wird ausschliesslich ueber die Gruppenzugehoerigkeit - das
    System speichert **nie**, warum jemand ausgenommen ist.

    Die Aenderung setzt die Preflight-Bestaetigung zurueck: Sie galt fuer einen
    anderen Empfaengerkreis.
    """
    campaign = _get_or_404(db, campaign_id)
    known = {
        gid for (gid,) in db.query(Group.id).filter(Group.id.in_(payload.group_ids))
    } if payload.group_ids else set()
    unknown = set(payload.group_ids) - known
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Unbekannte Gruppe im Ausschluss"
        )

    db.query(CampaignGroupExclusion).filter(
        CampaignGroupExclusion.campaign_id == campaign_id
    ).delete(synchronize_session=False)
    for group_id in known:
        db.add(CampaignGroupExclusion(campaign_id=campaign_id, group_id=group_id))

    campaign.preflight_ack_at = None
    campaign.preflight_ack_by_id = None
    record_audit(
        db,
        action="campaign.exclusions.updated",
        description=f"Kampagne '{campaign.name}': {len(known)} Gruppe(n) ausgeschlossen"[:512],
        actor=current_user,
        ip=client_ip(request),
    )
    db.commit()
    return preflight.excluded_group_ids(db, campaign_id)


# --- Zweitfreigabe bei hoher Risikoklasse (Welle 9.2) -----------------------


def _approval_out(row: CampaignApproval) -> CampaignApprovalOut:
    return CampaignApprovalOut(
        id=row.id,
        campaign_id=row.campaign_id,
        requested_by_email=row.requested_by_email,
        reason=row.reason,
        status=row.status.value,
        decided_by_email=row.decided_by_email or None,
        decided_at=row.decided_at,
        note=row.note,
        created_at=row.created_at,
    )


@router.get("/{campaign_id}/approval", response_model=CampaignApprovalOut | None)
def read_approval(
    campaign_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)
) -> CampaignApprovalOut | None:
    _get_or_404(db, campaign_id)
    row = preflight.latest_approval(db, campaign_id)
    return _approval_out(row) if row is not None else None


@router.post("/{campaign_id}/approval", response_model=CampaignApprovalOut, status_code=status.HTTP_201_CREATED)
def request_approval(
    campaign_id: uuid.UUID,
    payload: CampaignApprovalCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CampaignApprovalOut:
    """Beantragt die Zweitfreigabe fuer eine Kampagne hoher Risikoklasse."""
    campaign = _get_or_404(db, campaign_id)
    risk_class = campaign.template.risk_class if campaign.template else "low"
    if not preflight.requires_second_approval(risk_class):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Diese Kampagne braucht keine Zweitfreigabe.",
        )

    existing = preflight.latest_approval(db, campaign_id)
    if existing is not None and existing.status == CampaignApprovalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Es liegt bereits ein offener Antrag vor."
        )

    row = CampaignApproval(
        campaign_id=campaign_id,
        requested_by_id=current_user.id,
        requested_by_email=current_user.email,
        reason=payload.reason.strip(),
    )
    db.add(row)
    record_audit(
        db,
        action="campaign.approval.requested",
        description=f"Zweitfreigabe beantragt fuer '{campaign.name}'"[:512],
        actor=current_user,
        ip=client_ip(request),
    )
    db.commit()
    db.refresh(row)
    return _approval_out(row)


@router.patch("/{campaign_id}/approval/{approval_id}", response_model=CampaignApprovalOut)
def decide_approval(
    campaign_id: uuid.UUID,
    approval_id: uuid.UUID,
    payload: CampaignApprovalDecision,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CampaignApprovalOut:
    """Entscheidet ueber einen Freigabeantrag.

    Wer beantragt, entscheidet nicht - das ist der ganze Zweck der Uebung. Die
    Trennung ist hier geprueft, in der Rollenpruefung und zusaetzlich als
    CheckConstraint in der Datenbank.
    """
    campaign = _get_or_404(db, campaign_id)
    row = db.get(CampaignApproval, approval_id)
    if row is None or row.campaign_id != campaign_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Antrag nicht gefunden")
    if row.status != CampaignApprovalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ueber diesen Antrag wurde bereits entschieden."
        )

    config = preflight.get_config(db)
    if not preflight.may_decide(current_user, config):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Die Zweitfreigabe erteilt die Rolle '{config.second_approval_role}'.",
        )
    if row.requested_by_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Wer beantragt, entscheidet nicht.",
        )

    row.status = (
        CampaignApprovalStatus.APPROVED if payload.approve else CampaignApprovalStatus.REJECTED
    )
    row.decided_by_id = current_user.id
    row.decided_by_email = current_user.email
    row.decided_at = datetime.now(timezone.utc)
    row.note = (payload.note or "").strip() or None

    record_audit(
        db,
        action="campaign.approval.decided",
        description=f"Zweitfreigabe fuer '{campaign.name}': {row.status.value}"[:512],
        actor=current_user,
        ip=client_ip(request),
    )
    db.commit()
    db.refresh(row)
    return _approval_out(row)
