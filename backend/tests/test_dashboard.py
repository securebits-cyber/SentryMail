# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer die Open-Core-Reporting-Endpunkte (Risikobewertung, Zeitachse)."""
from app.models import Campaign, Recipient, Template, TrackingEventType, UserRole
from app.services.tracking import record_event


def _seed(db, owner_id, event_type: TrackingEventType, token: str = "tok-dash-1"):
    template = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=owner_id)
    db.add(template)
    db.flush()
    campaign = Campaign(name="C", template_id=template.id, created_by_id=owner_id)
    db.add(campaign)
    db.flush()
    db.add(Recipient(campaign_id=campaign.id, email="z@example.com", tracking_token=token))
    db.commit()
    record_event(db, tracking_token=token, event_type=event_type)
    return campaign


def test_risk_empty_is_zero(client, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    body = client.get("/dashboard/risk", headers=auth_headers(admin)).json()
    assert body["score"] == 0
    assert body["level"] == "low"
    assert body["recipients"] == 0


def test_risk_score_reflects_click(client, db, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    _seed(db, admin.id, TrackingEventType.CLICKED)
    body = client.get("/dashboard/risk", headers=auth_headers(admin)).json()
    # 1 Empfaenger, geklickt -> 60 Punkte -> Score 60, Stufe medium
    assert body["score"] == 60
    assert body["level"] == "medium"
    assert body["distribution"]["medium"] == 1
    assert len(body["per_campaign"]) == 1
    assert body["per_campaign"][0]["score"] == 60


def test_risk_submitted_is_high(client, db, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    _seed(db, admin.id, TrackingEventType.SUBMITTED)
    body = client.get("/dashboard/risk", headers=auth_headers(admin)).json()
    assert body["score"] == 100
    assert body["level"] == "high"
    assert body["distribution"]["high"] == 1


def test_timeline_point_after_open(client, db, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    _seed(db, admin.id, TrackingEventType.OPENED)
    points = client.get("/dashboard/timeline", headers=auth_headers(admin)).json()
    assert len(points) == 1
    assert points[0]["opened"] == 1
    assert points[0]["clicked"] == 0
