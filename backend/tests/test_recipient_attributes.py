# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Abteilung/Kritikalitaet/Funktion werden von der Gruppe auf die Kampagnen-
Empfaenger uebernommen und in den Ergebnissen ausgewiesen."""
from app.models import Template, UserRole


def test_group_attributes_propagate_to_recipient(client, db, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    headers = auth_headers(admin)

    template = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=admin.id)
    db.add(template)
    db.commit()
    db.refresh(template)

    # Gruppe mit Person-Attributen anlegen.
    group = client.post(
        "/groups",
        headers=headers,
        json={
            "name": "Buchhaltung",
            "members": [
                {
                    "email": "max@example.com",
                    "first_name": "Max",
                    "position": "Sachbearbeiter",
                    "department": "Finanzen",
                    "criticality": "high",
                }
            ],
        },
    ).json()
    assert group["members"][0]["department"] == "Finanzen"
    assert group["members"][0]["criticality"] == "high"

    # Kampagne aus der Gruppe bauen.
    campaign = client.post(
        "/campaigns",
        headers=headers,
        json={"name": "C", "template_id": str(template.id), "group_ids": [group["id"]]},
    ).json()

    # Ergebnisse: der Empfaenger traegt die uebernommenen Attribute.
    results = client.get(f"/results/{campaign['id']}", headers=headers).json()
    recipient = results["recipients"][0]
    assert recipient["email"] == "max@example.com"
    assert recipient["position"] == "Sachbearbeiter"
    assert recipient["department"] == "Finanzen"
    assert recipient["criticality"] == "high"


def test_invalid_criticality_rejected(client, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    resp = client.post(
        "/groups",
        headers=auth_headers(admin),
        json={"name": "G", "members": [{"email": "a@example.com", "criticality": "kritisch"}]},
    )
    assert resp.status_code == 422  # nur low/normal/high erlaubt
