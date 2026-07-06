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


def test_pixel_endpoint_records_open(client, db, campaign_with_recipient):
    resp = client.get("/track/pixel", params={"t": "tok-known-123"})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/gif"
    events = db.query(TrackingEvent).all()
    assert len(events) == 1
    assert events[0].event_type == TrackingEventType.OPENED


def test_click_endpoint_records_click_and_redirects(client, db, campaign_with_recipient):
    resp = client.get(
        "/track/click",
        params={"t": "tok-known-123", "url": "https://example.com/ziel"},
        follow_redirects=False,
    )
    assert resp.status_code in (302, 307)
    assert resp.headers["location"] == "https://example.com/ziel"
    events = db.query(TrackingEvent).all()
    assert len(events) == 1
    assert events[0].event_type == TrackingEventType.CLICKED


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


def test_click_captures_utm_params(client, db, campaign_with_recipient):
    resp = client.get(
        "/track/click",
        params={
            "t": "tok-known-123",
            "url": "https://example.com/ziel",
            "utm_source": "newsletter",
            "utm_medium": "email",
            "utm_campaign": "q3-awareness",
        },
        follow_redirects=False,
    )
    assert resp.status_code in (302, 307)
    event = db.query(TrackingEvent).one()
    assert event.utm_source == "newsletter"
    assert event.utm_medium == "email"
    assert event.utm_campaign == "q3-awareness"


def test_click_rejects_non_http_scheme(client, db, campaign_with_recipient):
    """Open-Redirect-Schutz: javascript:/data:-Ziele werden nicht weitergeleitet."""
    resp = client.get(
        "/track/click",
        params={"t": "tok-known-123", "url": "javascript:alert(1)"},
        follow_redirects=False,
    )
    assert resp.status_code == 200
    assert "location" not in resp.headers


def test_click_unknown_token_does_not_redirect(client, db):
    """Ohne gueltiges Token darf der Endpunkt kein offener Redirector sein."""
    resp = client.get(
        "/track/click",
        params={"t": "unknown", "url": "https://evil.example/phish"},
        follow_redirects=False,
    )
    assert resp.status_code == 200
    assert "location" not in resp.headers
    assert db.query(TrackingEvent).count() == 0


def test_pixel_unknown_token_still_returns_gif(client, db):
    """Unbekannter Token -> kein Event, aber der Pixel wird trotzdem ausgeliefert
    (verraet dem Empfaenger nichts)."""
    resp = client.get("/track/pixel", params={"t": "unknown"})
    assert resp.status_code == 200
    assert db.query(TrackingEvent).count() == 0
