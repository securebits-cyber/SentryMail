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


def _seed_person_over_campaigns(db, owner_id, email, per_campaign_events, criticality=None):
    """Legt fuer eine Person je Kampagne einen Recipient an und erfasst das
    angegebene Ereignis. ``per_campaign_events`` ist eine Liste von Event-Typen
    (oder None fuer keine Interaktion)."""
    template = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=owner_id)
    db.add(template)
    db.flush()
    for i, ev in enumerate(per_campaign_events):
        campaign = Campaign(name=f"C{i}", template_id=template.id, created_by_id=owner_id)
        db.add(campaign)
        db.flush()
        token = f"tok-{email}-{i}"
        db.add(Recipient(
            campaign_id=campaign.id, email=email, tracking_token=token, criticality=criticality,
        ))
        db.commit()
        if ev is not None:
            record_event(db, tracking_token=token, event_type=ev)


def test_human_risk_empty(client, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    body = client.get("/dashboard/human-risk", headers=auth_headers(admin)).json()
    assert body["people"] == 0
    assert body["score"] == 0
    assert body["top_people"] == []


def test_human_risk_flags_repeat_offender(client, db, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    # Person klickt in 2 von 2 Kampagnen -> Wiederholungstaeter.
    _seed_person_over_campaigns(
        db, admin.id, "wiederholt@example.com",
        [TrackingEventType.CLICKED, TrackingEventType.CLICKED],
    )
    body = client.get("/dashboard/human-risk", headers=auth_headers(admin)).json()
    assert body["people"] == 1
    assert body["repeat_offenders"] == 1
    person = body["top_people"][0]
    assert person["fails"] == 2
    assert person["repeat_offender"] is True
    assert person["behavior_score"] == 60
    # 60 + Wiederholungszuschlag (10) = 70, ohne Kritikalitaets-Faktor.
    assert person["score"] == 70


def test_human_risk_weights_criticality(client, db, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    _seed_person_over_campaigns(
        db, admin.id, "kritisch@example.com", [TrackingEventType.CLICKED], criticality="high",
    )
    body = client.get("/dashboard/human-risk", headers=auth_headers(admin)).json()
    person = body["top_people"][0]
    assert person["criticality"] == "high"
    # 60 * 1.2 (high) = 72, kein Wiederholungszuschlag (nur 1 Fail).
    assert person["score"] == 72


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
