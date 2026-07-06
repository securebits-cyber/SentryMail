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


_CHROME_WIN = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def test_analytics_empty(client, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    body = client.get("/dashboard/analytics", headers=auth_headers(admin)).json()
    assert body["total_events"] == 0
    assert body["browsers"] == []
    assert body["utm_sources"] == []


def test_analytics_breaks_down_engaged_events(client, db, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    template = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=admin.id)
    db.add(template)
    db.flush()
    campaign = Campaign(name="C", template_id=template.id, created_by_id=admin.id)
    db.add(campaign)
    db.flush()
    db.add(Recipient(campaign_id=campaign.id, email="z@example.com", tracking_token="tok-an-1"))
    db.commit()
    # Ein reines OPEN (nicht "engaged") darf nicht in die Aufschluesselung zaehlen.
    record_event(db, "tok-an-1", TrackingEventType.OPENED, user_agent=_CHROME_WIN)
    record_event(
        db, "tok-an-1", TrackingEventType.CLICKED, user_agent=_CHROME_WIN,
        utm={"utm_source": "newsletter", "utm_medium": None, "utm_campaign": None},
    )

    body = client.get("/dashboard/analytics", headers=auth_headers(admin)).json()
    assert body["total_events"] == 1  # nur der Klick
    assert body["browsers"] == [{"label": "Chrome", "count": 1}]
    assert body["operating_systems"] == [{"label": "Windows 10/11", "count": 1}]
    assert body["devices"] == [{"label": "desktop", "count": 1}]
    assert body["utm_sources"] == [{"label": "newsletter", "count": 1}]


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


def test_heatmap_empty(client, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    body = client.get("/dashboard/heatmap", headers=auth_headers(admin)).json()
    assert body["total_events"] == 0
    assert body["max_count"] == 0
    assert body["cells"] == []


def test_heatmap_counts_events(client, db, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    _seed(db, admin.id, TrackingEventType.CLICKED)
    body = client.get("/dashboard/heatmap", headers=auth_headers(admin)).json()
    assert body["total_events"] == 1
    assert body["max_count"] == 1
    assert len(body["cells"]) == 1
    cell = body["cells"][0]
    assert 0 <= cell["weekday"] <= 6
    assert 0 <= cell["hour"] <= 23
    assert cell["count"] == 1


def test_management_report_reflects_click(client, db, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    _seed(db, admin.id, TrackingEventType.CLICKED)
    body = client.get("/reports/management", headers=auth_headers(admin)).json()
    assert body["recipients"] == 1
    assert body["clicked"] == 1
    assert body["click_rate"] == 100
    assert body["risk_score"] == 60
    assert body["risk_level"] == "medium"
    assert len(body["campaign_rows"]) == 1
    assert body["campaign_rows"][0]["click_rate"] == 100
    assert len(body["top_failed"]) == 1


def test_management_report_csv_export(client, db, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    _seed(db, admin.id, TrackingEventType.CLICKED)
    resp = client.get("/reports/management/export", headers=auth_headers(admin))
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "Management Report" in resp.text
    assert "Kampagne" in resp.text  # Vergleichs-Tabellenkopf
