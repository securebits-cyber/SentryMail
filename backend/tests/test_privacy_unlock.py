# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer die Vier-Augen-Freigabe (Welle 2, Schritt A3).

Der Kern ist nicht der Happy Path, sondern dass die Regel sich nicht umgehen
laesst: keine Selbstfreigabe, keine unbefristete Wirkung, keine Ausweitung
einer Kampagnenfreigabe auf alles.
"""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import (
    AuditEvent,
    Campaign,
    CampaignStatus,
    PrivacyConfig,
    PrivacyUnlockRequest,
    PrivacyUnlockStatus,
    Recipient,
    Template,
    TrackingEvent,
    TrackingEventType,
    User,
    UserRole,
)
from app.services import privacy
from app.utils.passwords import hash_password
from app.utils.singleton import get_or_create_singleton

REASON = "Verdacht auf gezielten Angriff, Einzelfallpruefung noetig"


@pytest.fixture
def enable_mode(db):
    def _enable() -> None:
        config: PrivacyConfig = get_or_create_singleton(db, PrivacyConfig)
        config.privacy_mode_enabled = True
        db.commit()

    return _enable


@pytest.fixture
def campaign(db):
    """Kampagne mit sechs Empfaengern (ueber der k-Schwelle)."""
    owner = User(
        email="owner@example.com",
        full_name="Eigner",
        password_hash=hash_password("correct horse battery staple"),
        role=UserRole.ADMIN,
    )
    db.add(owner)
    db.flush()
    template = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=owner.id)
    db.add(template)
    db.flush()
    row = Campaign(
        name="Kampagne",
        template_id=template.id,
        created_by_id=owner.id,
        status=CampaignStatus.COMPLETED,
    )
    db.add(row)
    db.flush()
    now = datetime.now(timezone.utc)
    for i in range(6):
        recipient = Recipient(
            campaign_id=row.id, email=f"p{i}@example.com", tracking_token=f"tok-{i}", sent_at=now
        )
        db.add(recipient)
        db.flush()
        db.add(
            TrackingEvent(
                recipient_id=recipient.id,
                event_type=TrackingEventType.CLICKED,
                occurred_at=now,
            )
        )
    db.commit()
    return row


@pytest.fixture
def actors(make_user):
    admin = make_user(email="admin@example.com", role=UserRole.ADMIN)
    officer = make_user(email="dsb@example.com", role=UserRole.PRIVACY_OFFICER)
    return admin, officer


def _request_unlock(client, headers, **overrides) -> dict:
    payload = {"reason": REASON, **overrides}
    res = client.post("/privacy/unlock-requests", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


# --- Vier-Augen-Regel --------------------------------------------------------


def test_officer_cannot_be_bypassed_by_admin(client, actors, auth_headers):
    """Ein Admin darf beantragen, aber nicht entscheiden."""
    admin, _ = actors
    headers = auth_headers(admin)
    created = _request_unlock(client, headers)

    assert client.post(f"/privacy/unlock-requests/{created['id']}/approve", headers=headers).status_code == 403


def test_officer_cannot_approve_own_request(client, make_user, auth_headers, db):
    """Selbst wenn der Freigeber selbst beantragt: kein Durchgriff.

    Der Antrag entsteht hier direkt in der DB, weil die API einem
    Datenschutzbeauftragten das Beantragen ohnehin verwehrt.
    """
    officer = make_user(email="dsb@example.com", role=UserRole.PRIVACY_OFFICER)
    row = PrivacyUnlockRequest(
        requested_by_id=officer.id, requested_by_email=officer.email, reason=REASON
    )
    db.add(row)
    db.commit()

    res = client.post(f"/privacy/unlock-requests/{row.id}/approve", headers=auth_headers(officer))
    assert res.status_code == 403


def test_database_rejects_self_approval(db, make_user):
    """Letzte Verteidigungslinie: der CheckConstraint, nicht die Anwendung."""
    admin = make_user(email="admin@example.com", role=UserRole.ADMIN)
    row = PrivacyUnlockRequest(
        requested_by_id=admin.id,
        requested_by_email=admin.email,
        reason=REASON,
        status=PrivacyUnlockStatus.APPROVED,
        decided_by_id=admin.id,
        decided_at=datetime.now(timezone.utc),
    )
    db.add(row)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_plain_user_can_neither_request_nor_see(client, make_user, auth_headers):
    headers = auth_headers(make_user(email="u@example.com", role=UserRole.USER))
    assert client.post("/privacy/unlock-requests", json={"reason": REASON}, headers=headers).status_code == 403
    assert client.get("/privacy/unlock-requests", headers=headers).status_code == 403


def test_reason_is_mandatory(client, actors, auth_headers):
    """Ohne Begruendung kann der Freigeber nicht entscheiden."""
    admin, _ = actors
    res = client.post("/privacy/unlock-requests", json={"reason": "zu kurz"}, headers=auth_headers(admin))
    assert res.status_code == 422


# --- Wirkung der Freigabe ----------------------------------------------------


def test_approved_unlock_opens_the_locked_view(client, actors, auth_headers, campaign, enable_mode):
    admin, officer = actors
    admin_headers, officer_headers = auth_headers(admin), auth_headers(officer)
    enable_mode()

    assert client.get(f"/results/{campaign.id}", headers=admin_headers).json()["individuals_locked"] is True

    created = _request_unlock(client, admin_headers)
    approved = client.post(
        f"/privacy/unlock-requests/{created['id']}/approve", headers=officer_headers
    )
    assert approved.status_code == 200
    assert approved.json()["active"] is True

    body = client.get(f"/results/{campaign.id}", headers=admin_headers).json()
    assert body["individuals_locked"] is False
    assert len(body["recipients"]) == 6
    assert client.get("/dashboard/failed", headers=admin_headers).status_code == 200


def test_unlock_is_personal(client, actors, auth_headers, make_user, campaign, enable_mode):
    """Die Freigabe gilt dem Antragsteller, nicht der Rolle."""
    admin, officer = actors
    other = make_user(email="admin2@example.com", role=UserRole.ADMIN)
    enable_mode()

    created = _request_unlock(client, auth_headers(admin))
    client.post(f"/privacy/unlock-requests/{created['id']}/approve", headers=auth_headers(officer))

    assert client.get("/dashboard/failed", headers=auth_headers(admin)).status_code == 200
    assert client.get("/dashboard/failed", headers=auth_headers(other)).status_code == 403


def test_campaign_scope_does_not_open_everything(
    client, actors, auth_headers, campaign, enable_mode
):
    """Eine Einzelfreigabe darf keine Gesamtsicht erzeugen."""
    admin, officer = actors
    admin_headers = auth_headers(admin)
    enable_mode()

    created = _request_unlock(client, admin_headers, campaign_id=str(campaign.id))
    client.post(f"/privacy/unlock-requests/{created['id']}/approve", headers=auth_headers(officer))

    assert client.get(f"/results/{campaign.id}", headers=admin_headers).json()["individuals_locked"] is False
    # Dashboard und Management-Report sind kampagnenuebergreifend -> weiterhin gesperrt.
    assert client.get("/dashboard/failed", headers=admin_headers).status_code == 403
    assert client.get("/reports/management", headers=admin_headers).json()["individuals_locked"] is True


def test_expired_unlock_stops_working(client, actors, auth_headers, campaign, enable_mode, db):
    admin, officer = actors
    admin_headers = auth_headers(admin)
    enable_mode()

    created = _request_unlock(client, admin_headers)
    client.post(f"/privacy/unlock-requests/{created['id']}/approve", headers=auth_headers(officer))
    assert client.get("/dashboard/failed", headers=admin_headers).status_code == 200

    # Uhr vorstellen, statt im Test zu warten.
    row = db.get(PrivacyUnlockRequest, created["id"])
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()

    assert client.get("/dashboard/failed", headers=admin_headers).status_code == 403
    listed = client.get("/privacy/unlock-requests", headers=admin_headers).json()[0]
    assert listed["status"] == "expired"
    assert listed["active"] is False


def test_rejected_request_grants_nothing(client, actors, auth_headers, campaign, enable_mode):
    admin, officer = actors
    admin_headers = auth_headers(admin)
    enable_mode()

    created = _request_unlock(client, admin_headers)
    client.post(f"/privacy/unlock-requests/{created['id']}/reject", headers=auth_headers(officer))

    assert client.get("/dashboard/failed", headers=admin_headers).status_code == 403


def test_revoke_ends_the_unlock_immediately(client, actors, auth_headers, campaign, enable_mode):
    admin, officer = actors
    admin_headers = auth_headers(admin)
    enable_mode()

    created = _request_unlock(client, admin_headers)
    client.post(f"/privacy/unlock-requests/{created['id']}/approve", headers=auth_headers(officer))
    assert client.get("/dashboard/failed", headers=admin_headers).status_code == 200

    revoked = client.post(
        f"/privacy/unlock-requests/{created['id']}/revoke", headers=auth_headers(officer)
    )
    assert revoked.status_code == 200
    assert client.get("/dashboard/failed", headers=admin_headers).status_code == 403


def test_decision_cannot_be_repeated(client, actors, auth_headers):
    admin, officer = actors
    created = _request_unlock(client, auth_headers(admin))
    officer_headers = auth_headers(officer)

    assert client.post(f"/privacy/unlock-requests/{created['id']}/approve", headers=officer_headers).status_code == 200
    assert client.post(f"/privacy/unlock-requests/{created['id']}/reject", headers=officer_headers).status_code == 409


# --- Nachvollziehbarkeit -----------------------------------------------------


def test_every_step_is_audited(client, actors, auth_headers, db):
    admin, officer = actors
    created = _request_unlock(client, auth_headers(admin))
    client.post(f"/privacy/unlock-requests/{created['id']}/approve", headers=auth_headers(officer))
    client.post(f"/privacy/unlock-requests/{created['id']}/revoke", headers=auth_headers(officer))

    actions = [
        e.action
        for e in db.query(AuditEvent).order_by(AuditEvent.created_at).all()
        if e.action.startswith("privacy.unlock.")
    ]
    assert actions == [
        "privacy.unlock.requested",
        "privacy.unlock.approved",
        "privacy.unlock.revoked",
    ]
    requested = (
        db.query(AuditEvent).filter(AuditEvent.action == "privacy.unlock.requested").one()
    )
    # Die Begruendung gehoert ins Log - sonst belegt es nichts.
    assert REASON in requested.description


def test_officer_sees_requests_for_review(client, actors, auth_headers):
    admin, officer = actors
    _request_unlock(client, auth_headers(admin))
    rows = client.get("/privacy/unlock-requests", headers=auth_headers(officer)).json()
    assert len(rows) == 1
    assert rows[0]["requested_by_email"] == admin.email
    assert rows[0]["status"] == "pending"


def test_helper_reports_the_active_unlock(db, actors, campaign, enable_mode):
    """Der Service ist die einzige Wahrheitsquelle - auch fuer die Add-ons."""
    admin, officer = actors
    enable_mode()
    assert privacy.individual_view_allowed(db, admin) is False

    row = PrivacyUnlockRequest(
        requested_by_id=admin.id,
        requested_by_email=admin.email,
        reason=REASON,
        status=PrivacyUnlockStatus.APPROVED,
        decided_by_id=officer.id,
        decided_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(row)
    db.commit()

    assert privacy.individual_view_allowed(db, admin) is True
    assert privacy.active_unlock(db, admin).id == row.id
