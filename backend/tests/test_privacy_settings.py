# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer die Datenschutz-Policy und die Rolle ``privacy_officer``.

Welle 2, Rollentrennung: Der Datenschutzbeauftragte ist Kontroll-, keine
Betriebsrolle - er liest Policy und Audit-Log, aendert aber nichts.
"""
from app.models import AuditEvent, PrivacyConfig, UserRole

PAYLOAD = {
    "fingerprinting_enabled": False,
    "privacy_mode_enabled": True,
    "k_anonymity_threshold": 5,
}


def test_defaults_are_privacy_friendly(db):
    """Ohne Zutun des Betreibers ist alles aus - ein Update aendert kein Verhalten."""
    from app.api.settings import get_or_create_privacy_config

    config = get_or_create_privacy_config(db)
    assert config.fingerprinting_enabled is False
    assert config.privacy_mode_enabled is False
    assert config.k_anonymity_threshold == 5
    assert db.query(PrivacyConfig).count() == 1


def test_admin_can_read_and_update(client, make_user, auth_headers, db):
    admin = make_user(email="admin@example.com", role=UserRole.ADMIN)
    headers = auth_headers(admin)

    assert client.get("/settings/privacy", headers=headers).json()["privacy_mode_enabled"] is False

    res = client.put("/settings/privacy", json=PAYLOAD, headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["privacy_mode_enabled"] is True
    assert body["k_anonymity_threshold"] == 5

    stored = db.query(PrivacyConfig).one()
    assert stored.privacy_mode_enabled is True


def test_privacy_officer_may_read_but_not_update(client, make_user, auth_headers):
    officer = make_user(email="dsb@example.com", role=UserRole.PRIVACY_OFFICER)
    headers = auth_headers(officer)

    assert client.get("/settings/privacy", headers=headers).status_code == 200
    assert client.put("/settings/privacy", json=PAYLOAD, headers=headers).status_code == 403


def test_plain_user_sees_nothing(client, make_user, auth_headers):
    user = make_user(email="user@example.com", role=UserRole.USER)
    headers = auth_headers(user)

    assert client.get("/settings/privacy", headers=headers).status_code == 403
    assert client.put("/settings/privacy", json=PAYLOAD, headers=headers).status_code == 403


def test_privacy_officer_reads_audit_log(client, make_user, auth_headers):
    """Die Kontrollrolle ist ohne Einsicht in das Audit-Log wertlos."""
    officer = make_user(email="dsb@example.com", role=UserRole.PRIVACY_OFFICER)
    user = make_user(email="user@example.com", role=UserRole.USER)

    assert client.get("/audit-events", headers=auth_headers(officer)).status_code == 200
    assert client.get("/audit-events", headers=auth_headers(user)).status_code == 403


def test_k_threshold_below_two_is_rejected(client, make_user, auth_headers):
    """k = 1 waere keine Anonymisierung, sondern eine Einzelpersonen-Auswertung."""
    admin = make_user(role=UserRole.ADMIN)
    res = client.put(
        "/settings/privacy",
        json={**PAYLOAD, "k_anonymity_threshold": 1},
        headers=auth_headers(admin),
    )
    assert res.status_code == 422


def test_audit_records_only_actual_changes(client, make_user, auth_headers, db):
    admin = make_user(role=UserRole.ADMIN)
    headers = auth_headers(admin)

    client.put("/settings/privacy", json=PAYLOAD, headers=headers)
    first = db.query(AuditEvent).filter(AuditEvent.action == "settings.privacy.updated").one()
    assert "Datenschutzmodus aktiviert" in first.description
    assert "Client-Fingerprinting" not in first.description

    client.put("/settings/privacy", json=PAYLOAD, headers=headers)
    latest = (
        db.query(AuditEvent)
        .filter(AuditEvent.action == "settings.privacy.updated")
        .order_by(AuditEvent.created_at.desc())
        .first()
    )
    assert latest.description == "keine Änderung"
