"""CRUD-Endpunkte fuer Mail-Templates."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import Template, User
from app.schemas import TemplateCreate, TemplateOut, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Template).order_by(Template.created_at.desc()).all()


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(payload: TemplateCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    template = Template(**payload.model_dump(), created_by_id=current_user.id)
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(template_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template nicht gefunden")
    return template


@router.patch("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: uuid.UUID,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    template = db.query(Template).filter(Template.id == template_id).first()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template nicht gefunden")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(template, field, value)
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    template = db.query(Template).filter(Template.id == template_id).first()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template nicht gefunden")
    db.delete(template)
    db.commit()
