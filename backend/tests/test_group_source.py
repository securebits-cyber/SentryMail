# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer die Herkunft von Empfaengergruppen (Fundament fuer SCIM).

Kern der Regel: Eine Gruppe hat genau einen Eigentuemer. Was der Identity
Provider verwaltet, darf das Dashboard nicht anfassen - sonst ueberschreibt der
naechste Sync die Handarbeit wortlos.
"""
from app.api.groups import EXTERNALLY_MANAGED_CODE
from app.models import Group, GroupMember, UserRole


def _scim_group(db, owner, name: str = "IdP-Gruppe") -> Group:
    group = Group(name=name, created_by_id=owner.id, source="scim", external_id="idp-1")
    group.members.append(GroupMember(email="extern@example.com"))
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def test_new_groups_are_manual_by_default(client, make_user, auth_headers):
    """Bestandsverhalten bleibt: was im Dashboard entsteht, gehoert dem Dashboard."""
    admin = make_user(role=UserRole.ADMIN)
    res = client.post(
        "/groups",
        json={"name": "Vertrieb", "members": [{"email": "a@example.com"}]},
        headers=auth_headers(admin),
    )
    assert res.status_code == 201
    assert res.json()["source"] == "manual"


def test_manual_groups_stay_editable(client, make_user, auth_headers, db):
    """LDAP- und Entra-Importe machen eine Gruppe nicht fremdverwaltet."""
    admin = make_user(role=UserRole.ADMIN)
    group = Group(name="Handarbeit", created_by_id=admin.id)
    db.add(group)
    db.commit()

    headers = auth_headers(admin)
    assert client.patch(f"/groups/{group.id}", json={"name": "Neu"}, headers=headers).status_code == 200
    assert client.delete(f"/groups/{group.id}", headers=headers).status_code == 204


def test_external_group_cannot_be_changed(client, make_user, auth_headers, db):
    admin = make_user(role=UserRole.ADMIN)
    group = _scim_group(db, admin)
    headers = auth_headers(admin)

    res = client.patch(f"/groups/{group.id}", json={"name": "Umbenannt"}, headers=headers)
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == EXTERNALLY_MANAGED_CODE
    assert res.json()["detail"]["source"] == "scim"

    # Der Name ist unveraendert - die Ablehnung ist keine halbe Aenderung.
    db.refresh(group)
    assert group.name == "IdP-Gruppe"


def test_external_group_cannot_be_deleted(client, make_user, auth_headers, db):
    admin = make_user(role=UserRole.ADMIN)
    group = _scim_group(db, admin)

    assert client.delete(f"/groups/{group.id}", headers=auth_headers(admin)).status_code == 409
    assert db.get(Group, group.id) is not None


def test_external_group_stays_readable(client, make_user, auth_headers, db):
    """Schreibgeschuetzt heisst nicht unsichtbar - die Gruppe bleibt fuer
    Kampagnen nutzbar und in der Liste sichtbar."""
    admin = make_user(role=UserRole.ADMIN)
    group = _scim_group(db, admin)
    headers = auth_headers(admin)

    detail = client.get(f"/groups/{group.id}", headers=headers).json()
    assert detail["source"] == "scim"
    assert len(detail["members"]) == 1

    listed = client.get("/groups", headers=headers).json()
    assert [g["source"] for g in listed] == ["scim"]
