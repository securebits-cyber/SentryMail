# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Vier-Augen-Freigabe zur Aufhebung der Einzelpersonen-Sperre (Welle 2).

Verfahren: Ein Admin beantragt mit Begruendung, der Datenschutzbeauftragte
entscheidet. Der Antragsteller kann nicht selbst entscheiden - das ist der
ganze Zweck der Uebung und wird deshalb an drei Stellen gesichert: durch die
Rollen-Dependency, durch eine explizite Pruefung und durch einen
CheckConstraint in der Datenbank.

Jede Freigabe ist befristet und gilt nur fuer den Antragsteller, wahlweise nur
fuer eine Kampagne. Alle Schritte landen im Audit-Log.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.permissions import (
    require_admin,
    require_admin_or_privacy_officer,
    require_privacy_officer,
)
from app.database import get_db
from app.models import Campaign, PrivacyUnlockRequest, PrivacyUnlockStatus, User, UserRole
from app.schemas import (
    PrivacyOfficerOut,
    PrivacyUnlockCreate,
    PrivacyUnlockDecision,
    PrivacyUnlockOut,
)
from app.services import privacy_notify
from app.services.audit import client_ip, record_audit

router = APIRouter(prefix="/privacy", tags=["privacy"])


def _to_out(row: PrivacyUnlockRequest) -> PrivacyUnlockOut:
    """Abgelaufene Freigaben als solche ausweisen.

    ``expired`` ist kein gespeicherter Status: er ergibt sich aus der Zeit und
    braucht keinen Hintergrundjob, der ihn nachtraegt."""
    expired = (
        row.status == PrivacyUnlockStatus.APPROVED
        and row.expires_at is not None
        and row.expires_at <= datetime.now(timezone.utc)
    )
    return PrivacyUnlockOut(
        id=row.id,
        requested_by_email=row.requested_by_email,
        campaign_id=row.campaign_id,
        reason=row.reason,
        duration_hours=row.duration_hours,
        status="expired" if expired else row.status.value,
        decided_by_email=row.decided_by_email or None,
        decided_at=row.decided_at,
        expires_at=row.expires_at,
        created_at=row.created_at,
        active=row.status == PrivacyUnlockStatus.APPROVED and not expired,
    )


def _get_or_404(db: Session, request_id: uuid.UUID) -> PrivacyUnlockRequest:
    row = db.get(PrivacyUnlockRequest, request_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Antrag nicht gefunden")
    return row


def _scope_label(row: PrivacyUnlockRequest, db: Session) -> str:
    if row.campaign_id is None:
        return "alle Kampagnen"
    campaign = db.get(Campaign, row.campaign_id)
    return f"Kampagne „{campaign.name}“" if campaign else "eine Kampagne"


@router.get("/officers", response_model=list[PrivacyOfficerOut])
def list_officers(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_privacy_officer),
):
    """Aktive Datenschutzbeauftragte.

    Das Vier-Augen-Verfahren braucht mindestens einen - ohne ihn bleibt jeder
    Antrag fuer immer offen. Die Oberflaeche warnt deshalb, wenn die Liste leer
    ist, und nennt sonst die Ansprechpartner samt E-Mail.
    """
    return (
        db.query(User)
        .filter(User.role == UserRole.PRIVACY_OFFICER, User.is_active.is_(True))
        .order_by(User.email)
        .all()
    )


@router.get("/unlock-requests", response_model=list[PrivacyUnlockOut])
def list_requests(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_privacy_officer),
):
    """Antraege und Entscheidungen - fuer Betrieb und Kontrolle einsehbar."""
    rows = (
        db.query(PrivacyUnlockRequest).order_by(PrivacyUnlockRequest.created_at.desc()).limit(100).all()
    )
    return [_to_out(row) for row in rows]


@router.post("/unlock-requests", response_model=PrivacyUnlockOut, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: PrivacyUnlockCreate,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    """Freigabe beantragen. Die Begruendung ist Pflicht - ohne sie kann der
    Datenschutzbeauftragte nicht entscheiden und das Audit nichts belegen."""
    if payload.campaign_id is not None and db.get(Campaign, payload.campaign_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kampagne nicht gefunden")

    row = PrivacyUnlockRequest(
        requested_by_id=current.id,
        requested_by_email=current.email,
        campaign_id=payload.campaign_id,
        reason=payload.reason.strip(),
        duration_hours=payload.duration_hours,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    record_audit(
        db,
        action="privacy.unlock.requested",
        description=(
            f"Freigabe beantragt für {_scope_label(row, db)} · "
            f"{row.duration_hours} h · Begründung: {row.reason}"
        ),
        actor=current,
        ip=client_ip(request),
    )
    # Erst nach der Antwort versenden: haengt der Mailserver, darf der Antrag
    # nicht daran haengen.
    background.add_task(privacy_notify.notify_officers_of_request, row.id)
    return _to_out(row)


def _decide(
    db: Session,
    request: Request,
    background: BackgroundTasks,
    row: PrivacyUnlockRequest,
    officer: User,
    *,
    approve: bool,
    note: str | None,
) -> PrivacyUnlockOut:
    if row.status != PrivacyUnlockStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Antrag wurde bereits entschieden"
        )
    # Gehoert bereits der Rolle nach nicht vorkommen - hier trotzdem geprueft,
    # damit die Vier-Augen-Regel nicht an einer einzigen Dependency haengt.
    if row.requested_by_id == officer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Eigene Anträge dürfen nicht selbst entschieden werden",
        )

    now = datetime.now(timezone.utc)
    row.status = PrivacyUnlockStatus.APPROVED if approve else PrivacyUnlockStatus.REJECTED
    row.decided_by_id = officer.id
    row.decided_by_email = officer.email
    row.decided_at = now
    row.expires_at = now + timedelta(hours=row.duration_hours) if approve else None
    db.commit()
    db.refresh(row)

    suffix = f" · Anmerkung: {note.strip()}" if note and note.strip() else ""
    record_audit(
        db,
        action="privacy.unlock.approved" if approve else "privacy.unlock.rejected",
        description=(
            f"Freigabe für {row.requested_by_email} "
            f"{'erteilt' if approve else 'abgelehnt'} · {_scope_label(row, db)}"
            + (f" · gültig bis {row.expires_at:%Y-%m-%d %H:%M} UTC" if approve else "")
            + suffix
        ),
        actor=officer,
        ip=client_ip(request),
    )
    background.add_task(privacy_notify.notify_requester_of_decision, row.id, approve)
    return _to_out(row)


@router.post("/unlock-requests/{request_id}/approve", response_model=PrivacyUnlockOut)
def approve_request(
    request_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    payload: PrivacyUnlockDecision | None = None,
    db: Session = Depends(get_db),
    officer: User = Depends(require_privacy_officer),
):
    row = _get_or_404(db, request_id)
    return _decide(db, request, background, row, officer, approve=True, note=payload.note if payload else None)


@router.post("/unlock-requests/{request_id}/reject", response_model=PrivacyUnlockOut)
def reject_request(
    request_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    payload: PrivacyUnlockDecision | None = None,
    db: Session = Depends(get_db),
    officer: User = Depends(require_privacy_officer),
):
    row = _get_or_404(db, request_id)
    return _decide(db, request, background, row, officer, approve=False, note=payload.note if payload else None)


@router.post("/unlock-requests/{request_id}/revoke", response_model=PrivacyUnlockOut)
def revoke_request(
    request_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin_or_privacy_officer),
):
    """Freigabe vorzeitig beenden.

    Erlaubt fuer den Datenschutzbeauftragten (Kontrolle) und den Antragsteller
    selbst (wer seine Freigabe nicht mehr braucht, soll sie zurueckgeben
    koennen). Ein anderer Admin kann fremde Freigaben nicht beenden.
    """
    row = _get_or_404(db, request_id)
    if row.status != PrivacyUnlockStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Nur erteilte Freigaben sind widerrufbar"
        )
    if current.role != UserRole.PRIVACY_OFFICER and row.requested_by_id != current.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nur der Datenschutzbeauftragte oder der Antragsteller kann widerrufen",
        )

    row.status = PrivacyUnlockStatus.REVOKED
    row.expires_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    record_audit(
        db,
        action="privacy.unlock.revoked",
        description=f"Freigabe für {row.requested_by_email} widerrufen · {_scope_label(row, db)}",
        actor=current,
        ip=client_ip(request),
    )
    return _to_out(row)
