"""Eigenes Profil des angemeldeten Nutzers (lesen + Name/Passwort aendern)."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import UserOut
from app.utils.passwords import hash_password, verify_password

router = APIRouter(prefix="/me", tags=["me"])


class MeUpdate(BaseModel):
    full_name: str | None = None
    current_password: str | None = None
    new_password: str | None = None


@router.get("", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("", response_model=UserOut)
def update_me(payload: MeUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    if payload.new_password:
        # Ist bereits ein Passwort gesetzt (lokaler Login), muss das aktuelle stimmen.
        if current_user.password_hash is not None:
            if not payload.current_password or not verify_password(
                payload.current_password, current_user.password_hash
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Aktuelles Passwort ist falsch"
                )
        current_user.password_hash = hash_password(payload.new_password)

    db.commit()
    db.refresh(current_user)
    return current_user
