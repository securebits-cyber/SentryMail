# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""CRUD-Endpunkte fuer Mail-Templates."""
import base64
import html as html_lib
import uuid
from email import policy
from email.parser import BytesParser

MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024  # 10 MB pro Anhang

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import Template, User
from app.schemas import TemplateBase, TemplateCreate, TemplateOut, TemplateUpdate

router = APIRouter(prefix="/templates", tags=["templates"])


@router.post("/import-eml", response_model=TemplateBase)
async def import_eml(file: UploadFile = File(...), _: User = Depends(get_current_user)):
    """Parst eine hochgeladene .eml-Datei zu einem Vorlagen-Entwurf (Betreff, HTML, Text)."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Leere Datei.")
    try:
        msg = BytesParser(policy=policy.default).parsebytes(raw)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Datei konnte nicht als E-Mail gelesen werden.")

    subject = str(msg.get("subject") or "").strip()
    html_content = ""
    text_content: str | None = None
    attachments: list[dict] = []

    parts = msg.walk() if msg.is_multipart() else [msg]
    for part in parts:
        if part.get_content_maintype() == "multipart":
            continue
        ctype = part.get_content_type()
        filename = part.get_filename()

        # Teile mit Dateiname bzw. Disposition "attachment" -> als Anhang uebernehmen.
        if part.get_content_disposition() == "attachment" or filename:
            try:
                data = part.get_content()
            except Exception:  # noqa: BLE001
                continue
            if isinstance(data, str):
                data = data.encode("utf-8", "replace")
            if not data or len(data) > MAX_ATTACHMENT_BYTES:
                continue
            attachments.append(
                {
                    "filename": filename or "anhang",
                    "content_type": ctype or "application/octet-stream",
                    "content_b64": base64.b64encode(data).decode("ascii"),
                }
            )
            continue

        # Rumpf-Teile.
        try:
            content = part.get_content()
        except Exception:  # noqa: BLE001
            continue
        if isinstance(content, bytes):
            continue
        if ctype == "text/html" and not html_content:
            html_content = content
        elif ctype == "text/plain" and text_content is None:
            text_content = content

    if not html_content and text_content:
        escaped = html_lib.escape(text_content).replace("\n", "<br>\n")
        html_content = f"<p>{escaped}</p>"

    if not html_content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kein E-Mail-Inhalt (HTML/Text) gefunden.")

    name = subject or (file.filename or "Importierte Vorlage").rsplit(".", 1)[0]
    return TemplateBase(
        name=name,
        subject=subject,
        html_content=html_content,
        text_content=text_content,
        attachments=attachments,
    )


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
