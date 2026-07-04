"""CRUD- und Test-Endpunkte fuer SMTP-Sending-Profiles.

Lesen ist fuer jeden angemeldeten Nutzer erlaubt (Auswahl in Kampagnen),
Anlegen/Aendern/Loeschen/Testen nur fuer Admins (enthaelt Zugangsdaten).
Das Passwort wird verschluesselt gespeichert und nie zurueckgegeben.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user, require_admin
from app.database import get_db
from app.models import SendingProfile, User
from app.schemas import (
    SendingProfileCreate,
    SendingProfileOut,
    SendingProfileTestRequest,
    SendingProfileTestResult,
    SendingProfileUpdate,
)
from app.services.mail import send_test_email
from app.utils.crypto import decrypt, encrypt

router = APIRouter(prefix="/sending-profiles", tags=["sending-profiles"])


def _get_or_404(db: Session, profile_id: uuid.UUID) -> SendingProfile:
    profile = db.get(SendingProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sending Profile nicht gefunden")
    return profile


@router.get("", response_model=list[SendingProfileOut])
def list_profiles(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(SendingProfile).order_by(SendingProfile.created_at.desc()).all()


@router.post("", response_model=SendingProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(
    payload: SendingProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    profile = SendingProfile(**payload.model_dump(exclude={"password"}), created_by_id=current_user.id)
    if payload.password:
        profile.password_encrypted = encrypt(payload.password)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{profile_id}", response_model=SendingProfileOut)
def get_profile(profile_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _get_or_404(db, profile_id)


@router.patch("/{profile_id}", response_model=SendingProfileOut)
def update_profile(
    profile_id: uuid.UUID,
    payload: SendingProfileUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    profile = _get_or_404(db, profile_id)
    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    for field, value in data.items():
        setattr(profile, field, value)
    if password is not None:
        # Leerer String -> Passwort entfernen; sonst neu verschluesseln.
        profile.password_encrypted = encrypt(password) if password else None
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(profile_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    profile = _get_or_404(db, profile_id)
    db.delete(profile)
    db.commit()


@router.post("/{profile_id}/test", response_model=SendingProfileTestResult)
async def test_profile(
    profile_id: uuid.UUID,
    payload: SendingProfileTestRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    profile = _get_or_404(db, profile_id)
    password = decrypt(profile.password_encrypted) if profile.password_encrypted else None
    success, detail = await send_test_email(
        host=profile.host,
        port=profile.port,
        username=profile.username,
        password=password,
        from_email=profile.from_email,
        from_name=profile.from_name,
        tls_mode=profile.tls_mode,
        validate_certs=not profile.ignore_cert_errors,
        to_email=payload.email,
    )
    return SendingProfileTestResult(success=success, detail=detail)
