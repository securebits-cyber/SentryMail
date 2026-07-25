# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer Aufbewahrungsfrist und automatische Anonymisierung (Welle 2, A4).

Zwei Zusagen muessen halten: ohne gesetzte Frist passiert nichts, und mit Frist
verschwinden die Personen - nicht die Kennzahlen.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.models import (
    AuditEvent,
    Campaign,
    CampaignStatus,
    PrivacyConfig,
    Recipient,
    Template,
    TrackingEvent,
    TrackingEventType,
    User,
    UserRole,
)
from app.services import reporting, retention
from app.utils.passwords import hash_password
from app.utils.singleton import get_or_create_singleton


@pytest.fixture
def set_retention(db):
    def _set(days: int | None) -> None:
        config: PrivacyConfig = get_or_create_singleton(db, PrivacyConfig)
        config.retention_days = days
        db.commit()

    return _set


@pytest.fixture
def make_campaign(db):
    """Kampagne mit Empfaengern, Alter und Status frei waehlbar."""

    def _make(
        age_days: int,
        n: int = 3,
        status: CampaignStatus = CampaignStatus.COMPLETED,
        name: str = "Kampagne",
    ) -> Campaign:
        owner = db.query(User).filter(User.email == "owner@example.com").first()
        if owner is None:
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
        created = datetime.now(timezone.utc) - timedelta(days=age_days)
        campaign = Campaign(
            name=name, template_id=template.id, created_by_id=owner.id, status=status
        )
        db.add(campaign)
        db.flush()
        # created_at hat einen Server-Default -> nachtraeglich setzen.
        campaign.created_at = created
        for i in range(n):
            recipient = Recipient(
                campaign_id=campaign.id,
                email=f"{name}-{i}@example.com",
                first_name="Erika",
                last_name=f"Muster {i}",
                tracking_token=f"tok-{name}-{i}",
                sent_at=created,
            )
            db.add(recipient)
            db.flush()
            db.add(
                TrackingEvent(
                    recipient_id=recipient.id,
                    event_type=TrackingEventType.CLICKED,
                    occurred_at=created,
                    ip_address="203.0.113.7",
                    user_agent="Mozilla/5.0",
                    browser="Firefox",
                    os="Windows 10/11",
                    country="DE",
                    referrer="https://intranet.example.com/mail",
                    fingerprint="deadbeef",
                    screen_resolution="1920x1080",
                    client_language="de-DE",
                )
            )
        db.commit()
        return campaign

    return _make


# --- Ohne gesetzte Frist ------------------------------------------------------


def test_nothing_happens_without_a_retention_period(db, make_campaign):
    """Auslieferungszustand: ungefragt wird nichts geloescht."""
    make_campaign(age_days=3650)

    stats = retention.purge_expired(db)

    assert stats.recipients == 0
    assert db.query(Recipient).filter(Recipient.anonymized_at.isnot(None)).count() == 0
    assert db.query(Recipient).filter(Recipient.email.like("%@example.com")).count() == 3


def test_preview_reports_zero_without_a_period(db, make_campaign):
    make_campaign(age_days=3650)
    assert retention.preview(db).recipients == 0


def test_manual_run_is_refused_without_a_period(client, make_user, auth_headers, set_retention):
    set_retention(None)
    res = client.post("/settings/privacy/retention/run", headers=auth_headers(make_user()))
    assert res.status_code == 400


# --- Mit gesetzter Frist ------------------------------------------------------


def test_old_campaign_is_anonymised(db, make_campaign, set_retention):
    campaign = make_campaign(age_days=200, name="Alt")
    set_retention(90)

    stats = retention.purge_expired(db)

    assert stats == retention.RetentionStats(campaigns=1, recipients=3, events=3)
    recipients = db.query(Recipient).filter(Recipient.campaign_id == campaign.id).all()
    for r in recipients:
        assert r.email.endswith(f"@{retention.ANONYMOUS_DOMAIN}")
        assert r.first_name is None and r.last_name is None
        assert r.anonymized_at is not None


def test_recent_campaign_is_untouched(db, make_campaign, set_retention):
    make_campaign(age_days=10, name="Neu")
    set_retention(90)

    retention.purge_expired(db)

    assert db.query(Recipient).filter(Recipient.anonymized_at.isnot(None)).count() == 0


def test_running_campaign_is_never_touched(db, make_campaign, set_retention):
    """Eine laufende Kampagne braucht ihre Adressen noch zum Versenden."""
    make_campaign(age_days=200, status=CampaignStatus.RUNNING, name="Laeuft")
    set_retention(90)

    assert retention.purge_expired(db).recipients == 0


def test_metrics_survive_the_anonymisation(db, make_campaign, set_retention):
    """Der Kern der Zusage: die Personen verschwinden, die Zahlen bleiben."""
    make_campaign(age_days=200, n=4, name="Alt")
    set_retention(90)
    before = reporting.overall_summary(db)

    retention.purge_expired(db)

    after = reporting.overall_summary(db)
    assert after.clicked == before.clicked == 4
    assert after.recipients == before.recipients == 4


def test_identifying_event_fields_are_cleared_but_coarse_ones_remain(
    db, make_campaign, set_retention
):
    make_campaign(age_days=200, n=1, name="Alt")
    set_retention(90)

    retention.purge_expired(db)

    event = db.query(TrackingEvent).one()
    assert event.ip_address is None
    assert event.fingerprint is None
    assert event.referrer is None
    assert event.user_agent is None
    assert event.screen_resolution is None
    assert event.client_language is None
    # Grobe Merkmale bleiben - ohne Personenbezug sind sie fuer eine
    # Re-Identifikation wertlos, fuer die Auswertung aber noetig.
    assert event.browser == "Firefox"
    assert event.os == "Windows 10/11"
    assert event.country == "DE"
    assert event.event_type == TrackingEventType.CLICKED


def test_second_run_changes_nothing(db, make_campaign, set_retention):
    """Idempotent: der stuendliche Tick darf nicht jedes Mal neu 'anonymisieren'."""
    make_campaign(age_days=200, name="Alt")
    set_retention(90)

    first = retention.purge_expired(db)
    emails = sorted(r.email for r in db.query(Recipient).all())
    second = retention.purge_expired(db)

    assert first.recipients == 3
    assert second.recipients == 0
    assert sorted(r.email for r in db.query(Recipient).all()) == emails
    assert db.query(AuditEvent).filter(AuditEvent.action == "privacy.retention.purged").count() == 1


def test_run_is_recorded_and_audited(db, make_campaign, set_retention):
    make_campaign(age_days=200, name="Alt")
    set_retention(90)

    retention.purge_expired(db)

    config = get_or_create_singleton(db, PrivacyConfig)
    assert config.retention_last_run_at is not None
    entry = db.query(AuditEvent).filter(AuditEvent.action == "privacy.retention.purged").one()
    assert "3 Empfänger" in entry.description
    assert entry.actor_email == "system (automatisch)"


def test_timestamp_is_updated_even_without_findings(db, set_retention):
    """'Zuletzt ausgefuehrt' muss auch stimmen, wenn nichts faellig war."""
    set_retention(90)
    retention.purge_expired(db)
    assert get_or_create_singleton(db, PrivacyConfig).retention_last_run_at is not None


# --- API ----------------------------------------------------------------------


def test_preview_endpoint_shows_what_would_happen(
    client, make_user, auth_headers, db, make_campaign, set_retention
):
    make_campaign(age_days=200, n=5, name="Alt")
    make_campaign(age_days=5, n=2, name="Neu")
    set_retention(90)

    body = client.get("/settings/privacy/retention/preview", headers=auth_headers(make_user())).json()

    assert body == {"retention_days": 90, "campaigns": 1, "recipients": 5, "events": 5}
    # Die Vorschau veraendert nichts.
    assert db.query(Recipient).filter(Recipient.anonymized_at.isnot(None)).count() == 0


def test_manual_run_needs_admin_rights(client, make_user, auth_headers, set_retention):
    set_retention(90)
    officer = make_user(email="dsb@example.com", role=UserRole.PRIVACY_OFFICER)
    assert client.post("/settings/privacy/retention/run", headers=auth_headers(officer)).status_code == 403


def test_period_can_be_set_and_cleared_via_api(client, make_user, auth_headers, db):
    headers = auth_headers(make_user())
    payload = {
        "fingerprinting_enabled": False,
        "privacy_mode_enabled": True,
        "k_anonymity_threshold": 5,
        "retention_days": 180,
    }
    assert client.put("/settings/privacy", json=payload, headers=headers).json()["retention_days"] == 180

    cleared = client.put("/settings/privacy", json={**payload, "retention_days": None}, headers=headers)
    assert cleared.json()["retention_days"] is None

    entries = [
        e.description
        for e in db.query(AuditEvent).filter(AuditEvent.action == "settings.privacy.updated").all()
    ]
    assert any("Aufbewahrungsfrist aus → 180 Tage" in d for d in entries)
    assert any("Aufbewahrungsfrist 180 Tage → aus" in d for d in entries)


def test_zero_days_is_rejected(client, make_user, auth_headers):
    res = client.put(
        "/settings/privacy",
        json={
            "fingerprinting_enabled": False,
            "privacy_mode_enabled": False,
            "k_anonymity_threshold": 5,
            "retention_days": 0,
        },
        headers=auth_headers(make_user()),
    )
    assert res.status_code == 422
