"""Admin-verwaltete lokale Benutzerkonten (kein Self-Signup)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.permissions import require_admin
from app.database import get_db
from app.models import User, UserRole
from app.schemas import UserOut
from app.utils.passwords import hash_password

router = APIRouter(prefix="/users", tags=["users"])


def _active_admin_count(db: Session) -> int:
    return (
        db.query(func.count(User.id))
        .filter(User.role == UserRole.ADMIN, User.is_active.is_(True))
        .scalar()
        or 0
    )


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.USER


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = None


def _get_or_404(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Benutzer nicht gefunden")
    return user


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(User).filter(User.email == payload.email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-Mail wird bereits verwendet")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = _get_or_404(db, user_id)
    if user.id == current_user.id and payload.is_active is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Eigenes Konto nicht deaktivieren")

    # Letzten aktiven Admin nicht per Deaktivieren/Herabstufen entfernen.
    demoting = payload.role is not None and payload.role != UserRole.ADMIN
    deactivating = payload.is_active is False
    if user.role == UserRole.ADMIN and user.is_active and (demoting or deactivating):
        if _active_admin_count(db) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Der letzte aktive Admin darf nicht deaktiviert oder herabgestuft werden",
            )

    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    for field, value in data.items():
        setattr(user, field, value)
    if password:
        user.password_hash = hash_password(password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = _get_or_404(db, user_id)
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Eigenes Konto nicht loeschbar")
    if user.role == UserRole.ADMIN and user.is_active and _active_admin_count(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Der letzte aktive Admin kann nicht geloescht werden",
        )
    db.delete(user)
    db.commit()
