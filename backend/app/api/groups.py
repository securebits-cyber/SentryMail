# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""CRUD-Endpunkte fuer Empfaengergruppen.

Mitglieder koennen per CSV importiert werden (Frontend parst die Datei und
schickt sie als Liste). Der LDAP-Import liegt im Business-Add-on.

Extern verwaltete Gruppen (``source != "manual"``, aktuell SCIM) sind hier
schreibgeschuetzt: schrieben Dashboard und Identity Provider dieselbe Gruppe,
ueberschriebe der naechste Sync die Handarbeit wortlos wieder.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.permissions import get_current_user
from app.database import get_db
from app.models import Group, GroupMember, User
from app.schemas import (
    GroupCreate,
    GroupOut,
    GroupSummary,
    GroupUpdate,
)

router = APIRouter(prefix="/groups", tags=["groups"])


#: Stabiler Fehlercode, an dem das Frontend die Fremdverwaltung von einer
#: fehlenden Berechtigung unterscheidet.
EXTERNALLY_MANAGED_CODE = "group_externally_managed"


def _get_or_404(db: Session, group_id: uuid.UUID) -> Group:
    group = db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gruppe nicht gefunden")
    return group


def assert_manually_editable(group: Group) -> None:
    """Bricht ab, wenn die Gruppe von aussen verwaltet wird."""
    if group.source == "manual":
        return
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": EXTERNALLY_MANAGED_CODE,
            "source": group.source,
            "message": (
                f"Diese Gruppe wird extern verwaltet ({group.source}) und kann im "
                "Dashboard nicht geaendert werden."
            ),
        },
    )


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
    assert_manually_editable(group)
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
    assert_manually_editable(group)
    db.delete(group)
    db.commit()
