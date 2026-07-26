# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Regeln des Blast-Radius-Preflights (Welle 9.2, Core).

Verwaltet die Vorgaben, gegen die der Pflichtdialog vor dem Kampagnenstart
prueft: Ruhezeiten, Sperrfenster, Cooldown und die Rolle, die eine Zweitfreigabe
erteilt.

Lesen darf jeder angemeldete Nutzer - wer eine Kampagne plant, muss die
geltenden Ruhezeiten und Sperrfenster kennen. Aendern darf sie nur ein Admin.
Die Zweitfreigabe-Rolle steht ausdruecklich auch dem Datenschutzbeauftragten zur
Einsicht offen, weil sie seine eigene Zustaendigkeit betrifft.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user, require_admin
from app.database import get_db
from app.models import BlackoutWindow, User
from app.schemas import (
    BlackoutWindowCreate,
    BlackoutWindowOut,
    PreflightConfigOut,
    PreflightConfigUpdate,
)
from app.services import preflight
from app.services.audit import client_ip, record_audit

router = APIRouter(prefix="/preflight", tags=["preflight"])


@router.get("/config", response_model=PreflightConfigOut)
def read_config(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> PreflightConfigOut:
    config = preflight.get_config(db)
    return PreflightConfigOut(
        quiet_hours_start=config.quiet_hours_start,
        quiet_hours_end=config.quiet_hours_end,
        timezone=config.timezone,
        cooldown_days=config.cooldown_days,
        second_approval_role=config.second_approval_role,
    )


@router.put("/config", response_model=PreflightConfigOut)
def update_config(
    payload: PreflightConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> PreflightConfigOut:
    if not preflight.is_valid_timezone(payload.timezone):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unbekannte Zeitzone: {payload.timezone}",
        )
    # Nur eine der beiden Zeiten gesetzt waere ein halbes Fenster - stiller
    # Unsinn, der beim Pruefen nie greift. Lieber jetzt melden.
    if (payload.quiet_hours_start is None) != (payload.quiet_hours_end is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Ruhezeiten brauchen Anfang und Ende - oder beides leer.",
        )

    config = preflight.get_config(db)
    config.quiet_hours_start = payload.quiet_hours_start
    config.quiet_hours_end = payload.quiet_hours_end
    config.timezone = payload.timezone
    config.cooldown_days = payload.cooldown_days
    config.second_approval_role = payload.second_approval_role

    record_audit(
        db,
        action="settings.preflight.updated",
        description=(
            f"Ruhezeiten {payload.quiet_hours_start}-{payload.quiet_hours_end}, "
            f"Zeitzone {payload.timezone}, Cooldown {payload.cooldown_days} Tage, "
            f"Zweitfreigabe {payload.second_approval_role}"
        )[:512],
        actor=current_user,
        ip=client_ip(request),
    )
    db.commit()
    db.refresh(config)
    return read_config(db, current_user)


@router.get("/risk-themes")
def read_risk_themes(_: User = Depends(get_current_user)) -> dict:
    """Themenvorschlaege je Risikoklasse.

    Nur ein Vorschlag: Massgeblich ist die Klasse, die am Template gesetzt ist.
    Welches Thema als heikel gilt, entscheidet die Organisation.
    """
    return {"classes": preflight.risk_themes()}


# --- Sperrfenster -----------------------------------------------------------


@router.get("/blackouts", response_model=list[BlackoutWindowOut])
def list_blackouts(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(BlackoutWindow).order_by(BlackoutWindow.starts_at).all()


@router.post("/blackouts", response_model=BlackoutWindowOut, status_code=status.HTTP_201_CREATED)
def create_blackout(
    payload: BlackoutWindowCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> BlackoutWindow:
    if payload.ends_at <= payload.starts_at:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Das Ende muss nach dem Beginn liegen.",
        )
    window = BlackoutWindow(
        label=payload.label.strip(), starts_at=payload.starts_at, ends_at=payload.ends_at
    )
    db.add(window)
    record_audit(
        db,
        action="settings.blackout.created",
        description=f"Sperrfenster '{window.label}' {payload.starts_at} bis {payload.ends_at}"[:512],
        actor=current_user,
        ip=client_ip(request),
    )
    db.commit()
    db.refresh(window)
    return window


@router.delete("/blackouts/{window_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blackout(
    window_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> None:
    window = db.get(BlackoutWindow, window_id)
    if window is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sperrfenster nicht gefunden")
    record_audit(
        db,
        action="settings.blackout.deleted",
        description=f"Sperrfenster '{window.label}' entfernt"[:512],
        actor=current_user,
        ip=client_ip(request),
    )
    db.delete(window)
    db.commit()
