# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer die Tracking-Logik (Events erfassen + aggregieren) und die
oeffentlichen Tracking-Endpunkte (Pixel/Click)."""
import pytest

from app.models import (
    Campaign,
    Recipient,
    Template,
    TrackingEvent,
    TrackingEventType,
    User,
    UserRole,
)
from app.services.tracking import get_campaign_results, record_event


@pytest.fixture
def campaign_with_recipient(db):
    """Legt User -> Template -> Campaign -> Recipient an und gibt den Recipient zurueck."""
    user = User(email="owner@example.com", full_name="Owner", password_hash="x", role=UserRole.ADMIN)
    db.add(user)
    db.flush()
    template = Template(name="T", subject="S", html_content="<p>hi</p>", created_by_id=user.id)
    db.add(template)
    db.flush()
    campaign = Campaign(name="C", template_id=template.id, created_by_id=user.id)
    db.add(campaign)
    db.flush()
    recipient = Recipient(
        campaign_id=campaign.id,
        email="ziel@example.com",
        first_name="Ziel",
        last_name="Person",
        tracking_token="tok-known-123",
    )
    db.add(recipient)
    db.commit()
    db.refresh(recipient)
    return recipient


def test_record_event_creates_event(db, campaign_with_recipient):
    event = record_event(
        db,
        tracking_token="tok-known-123",
        event_type=TrackingEventType.OPENED,
        ip_address="203.0.113.5",
        user_agent="pytest-UA",
    )
    assert event is not None
    assert event.event_type == TrackingEventType.OPENED
    assert db.query(TrackingEvent).count() == 1


def test_record_event_unknown_token_is_noop(db, campaign_with_recipient):
    event = record_event(db, tracking_token="does-not-exist", event_type=TrackingEventType.OPENED)
    assert event is None
    assert db.query(TrackingEvent).count() == 0


def test_get_campaign_results_aggregates(db, campaign_with_recipient):
    recipient = campaign_with_recipient
    record_event(db, tracking_token=recipient.tracking_token, event_type=TrackingEventType.OPENED)
    record_event(db, tracking_token=recipient.tracking_token, event_type=TrackingEventType.CLICKED)

    results = get_campaign_results(db, recipient.campaign_id)
    assert results.total_recipients == 1
    assert results.opened == 1
    assert results.clicked == 1
    assert results.submitted == 0
    assert results.recipients[0].opened is True
    assert results.recipients[0].clicked is True
    assert results.recipients[0].submitted is False


def test_visits_counts_multiple_clicks(db, campaign_with_recipient):
    """Mehrfachbesuche: die Klick-Anzahl je Empfaenger wird gezaehlt."""
    recipient = campaign_with_recipient
    for _ in range(3):
        record_event(db, tracking_token=recipient.tracking_token, event_type=TrackingEventType.CLICKED)

    results = get_campaign_results(db, recipient.campaign_id)
    assert results.clicked == 1  # ein Empfaenger hat geklickt
    assert results.recipients[0].visits == 3


def test_recipient_events_endpoint_returns_session_history(
    client, db, campaign_with_recipient, make_user, auth_headers
):
    recipient = campaign_with_recipient
    record_event(db, tracking_token=recipient.tracking_token, event_type=TrackingEventType.OPENED)
    record_event(db, tracking_token=recipient.tracking_token, event_type=TrackingEventType.CLICKED)

    admin = make_user(email="viewer@example.com")
    resp = client.get(
        f"/results/{recipient.campaign_id}/recipients/{recipient.id}/events",
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert [e["event_type"] for e in body] == ["opened", "clicked"]


def test_pixel_endpoint_records_open(client, db, campaign_with_recipient):
    resp = client.get("/track/pixel", params={"t": "tok-known-123"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/gif"
    events = db.query(TrackingEvent).all()
    assert len(events) == 1
    assert events[0].event_type == TrackingEventType.OPENED


def test_pixel_enriches_event_from_headers(client, db, campaign_with_recipient):
    """Browser/OS/Device werden aus dem User-Agent abgeleitet, Referrer/Sprache
    aus den Headern erfasst."""
    resp = client.get(
        "/track/pixel",
        params={"t": "tok-known-123"},
        headers={
            "user-agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "referer": "https://mail.example.com/inbox",
            "accept-language": "de-DE,de;q=0.9",
        },
    )
    assert resp.status_code == 200
    event = db.query(TrackingEvent).one()
    assert event.browser == "Chrome"
    assert event.os == "Windows 10/11"
    assert event.device_type == "desktop"
    assert event.referrer == "https://mail.example.com/inbox"
    assert event.accept_language.startswith("de-DE")


def test_landing_captures_utm_params(client, db, campaign_with_recipient):
    """UTM-Parameter werden am Klick-Event der Landing Page erfasst."""
    resp = client.get(
        "/track/landing",
        params={
            "t": "tok-known-123",
            "utm_source": "newsletter",
            "utm_medium": "email",
            "utm_campaign": "q3-awareness",
        },
    )
    assert resp.status_code == 200
    event = db.query(TrackingEvent).one()
    assert event.event_type == TrackingEventType.CLICKED
    assert event.utm_source == "newsletter"
    assert event.utm_medium == "email"
    assert event.utm_campaign == "q3-awareness"


def test_client_beacon_enriches_latest_click(client, db, campaign_with_recipient):
    """Der Landing-Beacon traegt Aufloesung/Sprache am juengsten Klick-Event nach."""
    client.get("/track/landing", params={"t": "tok-known-123"})
    resp = client.get(
        "/track/client",
        params={"t": "tok-known-123", "res": "1920x1080", "lang": "de-DE"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/gif"
    click = (
        db.query(TrackingEvent)
        .filter(TrackingEvent.event_type == TrackingEventType.CLICKED)
        .one()
    )
    assert click.screen_resolution == "1920x1080"
    assert click.client_language == "de-DE"


def test_client_beacon_stores_fingerprint(client, db, campaign_with_recipient):
    """Der Beacon traegt einen gueltigen Hex-Fingerprint am Klick-Event nach."""
    client.get("/track/landing", params={"t": "tok-known-123"})
    client.get("/track/client", params={"t": "tok-known-123", "fp": "1a2b3c4d"})
    click = (
        db.query(TrackingEvent)
        .filter(TrackingEvent.event_type == TrackingEventType.CLICKED)
        .one()
    )
    assert click.fingerprint == "1a2b3c4d"


def test_client_beacon_rejects_bogus_fingerprint(client, db, campaign_with_recipient):
    """Nicht-Hex-Fingerprints (Manipulationsversuch) werden verworfen."""
    client.get("/track/landing", params={"t": "tok-known-123"})
    client.get("/track/client", params={"t": "tok-known-123", "fp": "<script>"})
    click = (
        db.query(TrackingEvent)
        .filter(TrackingEvent.event_type == TrackingEventType.CLICKED)
        .one()
    )
    assert click.fingerprint is None


def test_client_beacon_rejects_bogus_resolution(client, db, campaign_with_recipient):
    client.get("/track/landing", params={"t": "tok-known-123"})
    client.get("/track/client", params={"t": "tok-known-123", "res": "drop table", "lang": "en"})
    click = (
        db.query(TrackingEvent)
        .filter(TrackingEvent.event_type == TrackingEventType.CLICKED)
        .one()
    )
    assert click.screen_resolution is None  # ungueltiges Format verworfen
    assert click.client_language == "en"


def test_pixel_unknown_token_still_returns_gif(client, db):
    """Unbekannter Token -> kein Event, aber der Pixel wird trotzdem ausgeliefert
    (verraet dem Empfaenger nichts)."""
    resp = client.get("/track/pixel", params={"t": "unknown"})
    assert resp.status_code == 200
    assert db.query(TrackingEvent).count() == 0
