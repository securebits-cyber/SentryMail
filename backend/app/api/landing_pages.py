"""CRUD-Endpunkte fuer Landing Pages.

Verwaltung der Seiten; das Ausliefern und Erfassen von Formulardaten im
Kampagnenkontext wird im Campaign-Schritt verdrahtet.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import LandingPage, User
from app.schemas import LandingPageCreate, LandingPageOut, LandingPageUpdate

router = APIRouter(prefix="/landing-pages", tags=["landing-pages"])


def _get_or_404(db: Session, page_id: uuid.UUID) -> LandingPage:
    page = db.get(LandingPage, page_id)
    if page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Landing Page nicht gefunden")
    return page


@router.get("", response_model=list[LandingPageOut])
def list_pages(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(LandingPage).order_by(LandingPage.created_at.desc()).all()


@router.post("", response_model=LandingPageOut, status_code=status.HTTP_201_CREATED)
def create_page(payload: LandingPageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    page = LandingPage(**payload.model_dump(), created_by_id=current_user.id)
    db.add(page)
    db.commit()
    db.refresh(page)
    return page


@router.get("/{page_id}", response_model=LandingPageOut)
def get_page(page_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _get_or_404(db, page_id)


@router.patch("/{page_id}", response_model=LandingPageOut)
def update_page(
    page_id: uuid.UUID,
    payload: LandingPageUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    page = _get_or_404(db, page_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(page, field, value)
    db.commit()
    db.refresh(page)
    return page


@router.delete("/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_page(page_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    page = _get_or_404(db, page_id)
    db.delete(page)
    db.commit()
