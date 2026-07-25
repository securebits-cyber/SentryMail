# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer die Durchsetzung des Datenschutzmodus (Welle 2, Schritt A2).

Geprueft wird beides: die Sperre fuer Einzelpersonen-Auswertungen und die
k-Anonymitaet - jeweils mit ausgeschaltetem *und* eingeschaltetem Modus, damit
Regressionen in beide Richtungen auffallen.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.models import (
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
from app.services import privacy, reporting
from app.utils.passwords import hash_password
from app.utils.singleton import get_or_create_singleton


@pytest.fixture
def enable_mode(db):
    """Schaltet den Datenschutzmodus scharf; ``k`` optional abweichend."""

    def _enable(k: int = 5) -> None:
        config: PrivacyConfig = get_or_create_singleton(db, PrivacyConfig)
        config.privacy_mode_enabled = True
        config.k_anonymity_threshold = k
        db.commit()

    return _enable


@pytest.fixture
def template(db):
    """Kampagnen brauchen eine Vorlage, Vorlagen einen Ersteller."""
    owner = User(
        email="owner@example.com",
        full_name="Vorlagen-Eigner",
        password_hash=hash_password("correct horse battery staple"),
        role=UserRole.ADMIN,
    )
    db.add(owner)
    db.flush()
    tpl = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=owner.id)
    db.add(tpl)
    db.commit()
    return tpl


@pytest.fixture
def campaign_with_recipients(db, template):
    """Legt eine Kampagne mit ``n`` Empfaengern an, die alle geklickt haben."""

    def _make(n: int, name: str = "Testkampagne") -> Campaign:
        campaign = Campaign(
            name=name,
            template_id=template.id,
            created_by_id=template.created_by_id,
            status=CampaignStatus.COMPLETED,
        )
        db.add(campaign)
        db.flush()
        now = datetime.now(timezone.utc)
        for i in range(n):
            recipient = Recipient(
                campaign_id=campaign.id,
                email=f"person{i}@example.com",
                first_name="Test",
                last_name=f"Person {i}",
                tracking_token=f"tok-{name}-{i}",
                sent_at=now - timedelta(hours=1),
            )
            db.add(recipient)
            db.flush()
            db.add(
                TrackingEvent(
                    recipient_id=recipient.id,
                    event_type=TrackingEventType.CLICKED,
                    occurred_at=now,
                    browser="Firefox",
                )
            )
        db.commit()
        return campaign

    return _make


# --- Einzelpersonen-Sperre ---------------------------------------------------


def test_recipient_list_visible_while_mode_is_off(client, make_user, auth_headers, campaign_with_recipients):
    campaign = campaign_with_recipients(3)
    res = client.get(f"/results/{campaign.id}", headers=auth_headers(make_user()))
    body = res.json()
    assert body["individuals_locked"] is False
    assert len(body["recipients"]) == 3


def test_recipient_list_locked_but_totals_survive(
    client, make_user, auth_headers, campaign_with_recipients, enable_mode
):
    """Die Kampagnen-Kennzahlen bleiben nutzbar - nur die Namen verschwinden."""
    campaign = campaign_with_recipients(6)
    enable_mode()
    body = client.get(f"/results/{campaign.id}", headers=auth_headers(make_user())).json()
    assert body["individuals_locked"] is True
    assert body["recipients"] == []
    assert body["total_recipients"] == 6
    assert body["clicked"] == 6


def test_session_history_and_csv_export_are_blocked(
    client, make_user, auth_headers, campaign_with_recipients, enable_mode, db
):
    campaign = campaign_with_recipients(6)
    recipient = db.query(Recipient).filter(Recipient.campaign_id == campaign.id).first()
    headers = auth_headers(make_user())
    enable_mode()

    events = client.get(f"/results/{campaign.id}/recipients/{recipient.id}/events", headers=headers)
    assert events.status_code == 403
    assert events.json()["detail"]["code"] == privacy.INDIVIDUAL_LOCKED_CODE

    export = client.get(f"/results/{campaign.id}/export", headers=headers)
    assert export.status_code == 403


def test_failed_list_blocked_for_every_role(
    client, make_user, auth_headers, campaign_with_recipients, enable_mode
):
    """Die Sperre ist keine Rechtefrage - auch der Admin kommt nicht daran vorbei."""
    campaign_with_recipients(6)
    enable_mode()
    for email, role in (("a@example.com", UserRole.ADMIN), ("u@example.com", UserRole.USER)):
        headers = auth_headers(make_user(email=email, role=role))
        assert client.get("/dashboard/failed", headers=headers).status_code == 403


def test_human_risk_keeps_distribution_but_drops_names(
    client, make_user, auth_headers, campaign_with_recipients, enable_mode
):
    campaign_with_recipients(6)
    enable_mode()
    body = client.get("/dashboard/human-risk", headers=auth_headers(make_user())).json()
    assert body["individuals_locked"] is True
    assert body["top_people"] == []
    assert body["people"] == 6


def test_automation_still_sees_people(db, campaign_with_recipients, enable_mode):
    """Interne Automatik (LMS-Zuweisung) braucht die Liste - und zeigt sie niemandem."""
    campaign_with_recipients(6)
    enable_mode()
    summary = reporting.human_risk(db, for_automation=True)
    assert summary.individuals_locked is False
    assert len(summary.top_people) == 6


def test_management_report_drops_person_section(
    client, make_user, auth_headers, campaign_with_recipients, enable_mode
):
    campaign_with_recipients(6)
    enable_mode()
    headers = auth_headers(make_user())
    body = client.get("/reports/management", headers=headers).json()
    assert body["individuals_locked"] is True
    assert body["top_failed"] == []

    # Der CSV-Export bleibt nutzbar, benennt die Luecke aber ausdruecklich.
    csv_text = client.get("/reports/management/export", headers=headers).text
    assert "Im Datenschutzmodus gesperrt" in csv_text
    assert "person0@example.com" not in csv_text


# --- k-Anonymitaet -----------------------------------------------------------


@pytest.mark.parametrize(
    ("recipients", "expect_suppressed"),
    [(4, True), (5, False), (6, False)],
)
def test_breakdown_threshold_is_exact(
    client, make_user, auth_headers, campaign_with_recipients, enable_mode, recipients, expect_suppressed
):
    """Grenzfaelle: k = 5 bedeutet 'ab 5 sichtbar', nicht 'ab 6'."""
    campaign_with_recipients(recipients)
    enable_mode(k=5)
    body = client.get("/dashboard/analytics", headers=auth_headers(make_user())).json()
    browsers = body["browsers"]
    assert len(browsers) == 1
    assert browsers[0]["suppressed"] is expect_suppressed
    assert browsers[0]["count"] == (0 if expect_suppressed else recipients)
    # Die Gruppe verschwindet nie - sonst faellt die Luecke niemandem auf.
    assert browsers[0]["label"] == "Firefox"


def test_breakdown_counts_persons_not_events(
    client, make_user, auth_headers, enable_mode, db, template
):
    """Eine Person mit vielen Klicks hebt die Schwelle nicht auf."""
    campaign = Campaign(
        name="Einzelklicker",
        template_id=template.id,
        created_by_id=template.created_by_id,
        status=CampaignStatus.COMPLETED,
    )
    db.add(campaign)
    db.flush()
    recipient = Recipient(
        campaign_id=campaign.id, email="solo@example.com", tracking_token="tok-solo"
    )
    db.add(recipient)
    db.flush()
    now = datetime.now(timezone.utc)
    for _ in range(20):
        db.add(
            TrackingEvent(
                recipient_id=recipient.id,
                event_type=TrackingEventType.CLICKED,
                occurred_at=now,
                browser="Firefox",
            )
        )
    db.commit()
    enable_mode(k=5)

    body = client.get("/dashboard/analytics", headers=auth_headers(make_user())).json()
    assert body["browsers"][0]["suppressed"] is True


def test_small_campaign_row_is_suppressed_in_report(
    client, make_user, auth_headers, campaign_with_recipients, enable_mode
):
    campaign_with_recipients(3, name="Vorstand")
    campaign_with_recipients(8, name="Gesamtbelegschaft")
    enable_mode(k=5)
    rows = client.get("/reports/management", headers=auth_headers(make_user())).json()["campaign_rows"]
    by_name = {r["name"]: r for r in rows}

    assert by_name["Vorstand"]["suppressed"] is True
    assert by_name["Vorstand"]["clicked"] == 0
    assert by_name["Vorstand"]["recipients"] == 3  # Luecke bleibt sichtbar
    assert by_name["Gesamtbelegschaft"]["suppressed"] is False
    assert by_name["Gesamtbelegschaft"]["clicked"] == 8


def test_nothing_is_suppressed_while_mode_is_off(
    client, make_user, auth_headers, campaign_with_recipients
):
    campaign_with_recipients(2, name="Winzig")
    body = client.get("/dashboard/analytics", headers=auth_headers(make_user())).json()
    assert body["browsers"][0]["suppressed"] is False
    assert body["browsers"][0]["count"] == 2
