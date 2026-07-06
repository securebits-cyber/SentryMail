# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""CRUD-Endpunkte fuer Empfaengergruppen inkl. LDAP-Import.

Mitglieder koennen per CSV (Frontend parst und schickt sie als Liste) oder
per LDAP (POST /groups/{id}/import/ldap, nutzt die LdapConfig) hinzugefuegt
werden.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user, require_admin
from app.database import get_db
from app.models import Group, GroupMember, LdapConfig, User
from app.schemas import (
    GroupCreate,
    GroupOut,
    GroupSummary,
    GroupUpdate,
    LdapImportResult,
)
from app.services.ldap import LdapParams, fetch_users
from app.services.license import require_feature
from app.utils.crypto import decrypt

router = APIRouter(prefix="/groups", tags=["groups"])


def _get_or_404(db: Session, group_id: uuid.UUID) -> Group:
    group = db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gruppe nicht gefunden")
    return group


@router.get("", response_model=list[GroupSummary])
def list_groups(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Group).order_by(Group.created_at.desc()).all()


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(payload: GroupCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = Group(name=payload.name, created_by_id=current_user.id)
    for member in payload.members:
        group.members.append(GroupMember(**member.model_dump()))
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.get("/{group_id}", response_model=GroupOut)
def get_group(group_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _get_or_404(db, group_id)


@router.patch("/{group_id}", response_model=GroupOut)
def update_group(
    group_id: uuid.UUID,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    group = _get_or_404(db, group_id)
    if payload.name is not None:
        group.name = payload.name
    if payload.members is not None:
        # Vollstaendiger Austausch der Mitgliederliste.
        group.members.clear()
        for member in payload.members:
            group.members.append(GroupMember(**member.model_dump()))
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    group = _get_or_404(db, group_id)
    db.delete(group)
    db.commit()


@router.post(
    "/{group_id}/import/ldap",
    response_model=LdapImportResult,
    dependencies=[Depends(require_feature("business"))],  # LDAP-Import ist ein Business-Feature
)
def import_from_ldap(group_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    group = _get_or_404(db, group_id)

    config = db.query(LdapConfig).first()
    if config is None or not config.enabled or not config.host:
        return LdapImportResult(
            success=False,
            detail="LDAP ist nicht konfiguriert/aktiviert (siehe Einstellungen).",
        )

    params = LdapParams(
        host=config.host,
        port=config.port,
        use_ssl=config.use_ssl,
        start_tls=config.start_tls,
        bind_dn=config.bind_dn,
        bind_password=decrypt(config.bind_password_encrypted) if config.bind_password_encrypted else None,
        base_dn=config.base_dn,
        user_filter=config.user_filter,
        attr_email=config.attr_email,
        attr_first_name=config.attr_first_name,
        attr_last_name=config.attr_last_name,
    )

    try:
        found_users = fetch_users(params)
    except Exception as e:  # noqa: BLE001 - Rohmeldung an den Admin zurueckgeben
        return LdapImportResult(success=False, detail=f"LDAP-Fehler: {e}")

    existing = {m.email.lower() for m in group.members}
    added = 0
    for user in found_users:
        email = user["email"]
        if email.lower() in existing:
            continue
        existing.add(email.lower())
        group.members.append(
            GroupMember(email=email, first_name=user.get("first_name"), last_name=user.get("last_name"))
        )
        added += 1

    db.commit()
    db.refresh(group)
    return LdapImportResult(
        success=True,
        detail=f"{added} neue von {len(found_users)} gefundenen Empfaengern importiert.",
        found=len(found_users),
        added=added,
    )
