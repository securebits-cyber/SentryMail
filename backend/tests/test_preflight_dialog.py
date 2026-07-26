# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Pflichtdialog vor dem Kampagnenstart (Welle 9.2, Schritt B).

Zwei Zusagen stehen im Mittelpunkt: Ohne Bestaetigung startet nichts, und eine
Warnung ist eine Warnung - nur ein harter Befund haelt wirklich auf.
"""
from datetime import datetime, time, timedelta, timezone

import pytest

from app.models import (
    BlackoutWindow,
    Campaign,
    Group,
    GroupMember,
    Recipient,
    Template,
)
from app.services import preflight
from app.utils.security import generate_tracking_token


@pytest.fixture
def owner(make_user):
    return make_user(email="pfd-owner@example.com")


@pytest.fixture
def template(db, owner):
    row = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=owner.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _campaign(db, owner, template, *, scheduled_at=None, emails=("a@example.de", "b@example.de")):
    campaign = Campaign(
        name="Kampagne", template_id=template.id, created_by_id=owner.id, scheduled_at=scheduled_at
    )
    db.add(campaign)
    db.flush()
    for email in emails:
        db.add(
            Recipient(
                campaign_id=campaign.id, email=email, tracking_token=generate_tracking_token()
            )
        )
    db.commit()
    db.refresh(campaign)
    return campaign


def _group(db, owner, name, emails):
    group = Group(name=name, created_by_id=owner.id)
    db.add(group)
    db.flush()
    for email in emails:
        db.add(GroupMember(group_id=group.id, email=email))
    db.commit()
    db.refresh(group)
    return group


def _codes(result):
    return [f["code"] for f in result["findings"]]


# --- Umfang -----------------------------------------------------------------


def test_counts_and_groups(db, owner, template):
    campaign = _campaign(db, owner, template, emails=("a@example.de", "b@example.de", "c@example.de"))
    _group(db, owner, "Buchhaltung", ["a@example.de", "b@example.de"])
    result = preflight.evaluate(db, campaign)
    assert result["recipients_total"] == 3
    assert result["recipients_effective"] == 3
    assert result["groups"] == [{"id": result["groups"][0]["id"], "name": "Buchhaltung", "recipients": 2}]


def test_group_matching_ignores_case(db, owner, template):
    """Adressen kommen aus CSV-Importen und Verzeichnisdiensten - die
    Schreibweise ist dort nicht verlaesslich."""
    campaign = _campaign(db, owner, template, emails=("Anna@Example.DE",))
    _group(db, owner, "Vertrieb", ["anna@example.de"])
    assert preflight.evaluate(db, campaign)["groups"][0]["recipients"] == 1


def test_excluded_group_reduces_the_effective_count(db, owner, template):
    campaign = _campaign(db, owner, template, emails=("a@example.de", "b@example.de"))
    group = _group(db, owner, "Elternzeit-Vertretung", ["b@example.de"])
    from app.models import CampaignGroupExclusion

    db.add(CampaignGroupExclusion(campaign_id=campaign.id, group_id=group.id))
    db.commit()

    result = preflight.evaluate(db, campaign)
    assert result["recipients_total"] == 2
    assert result["recipients_excluded"] == 1
    assert result["recipients_effective"] == 1


def test_campaign_without_recipients_is_blocked(db, owner, template):
    campaign = _campaign(db, owner, template, emails=())
    result = preflight.evaluate(db, campaign)
    assert "no_recipients" in _codes(result)
    assert result["blocked"] is True


# --- Zeitliche Befunde ------------------------------------------------------


def test_quiet_hours_are_checked_for_the_scheduled_time_not_now(db, owner, template):
    """Sonst meldet der Dialog Ruhezeiten fuer den Moment des Hinsehens statt
    fuer den Versand - und genau umgekehrt."""
    config = preflight.get_config(db)
    config.timezone = "UTC"
    config.quiet_hours_start = time(22, 0)
    config.quiet_hours_end = time(6, 0)
    db.commit()

    at_night = datetime.now(timezone.utc).replace(hour=23, minute=0) + timedelta(days=1)
    campaign = _campaign(db, owner, template, scheduled_at=at_night)
    assert "quiet_hours" in _codes(preflight.evaluate(db, campaign))

    at_noon = datetime.now(timezone.utc).replace(hour=12, minute=0) + timedelta(days=1)
    campaign.scheduled_at = at_noon
    db.commit()
    assert "quiet_hours" not in _codes(preflight.evaluate(db, campaign))


def test_active_blackout_is_reported(db, owner, template):
    now = datetime.now(timezone.utc)
    db.add(
        BlackoutWindow(
            label="Betriebsversammlung", starts_at=now - timedelta(hours=1), ends_at=now + timedelta(hours=2)
        )
    )
    db.commit()
    campaign = _campaign(db, owner, template)
    result = preflight.evaluate(db, campaign)
    assert "blackout_active" in _codes(result)
    # Warnung, kein harter Befund: Der Betreiber entscheidet.
    assert result["blocked"] is False


def test_upcoming_blackout_is_only_an_info(db, owner, template):
    now = datetime.now(timezone.utc)
    db.add(
        BlackoutWindow(label="Jahresabschluss", starts_at=now + timedelta(hours=6), ends_at=now + timedelta(days=2))
    )
    db.commit()
    result = preflight.evaluate(db, _campaign(db, owner, template))
    finding = next(f for f in result["findings"] if f["code"] == "blackout_upcoming")
    assert finding["severity"] == "info"
    assert finding["params"]["label"] == "Jahresabschluss"


# --- Cooldown ---------------------------------------------------------------


def test_cooldown_counts_people_not_campaigns(db, owner, template):
    """Wer in drei alten Kampagnen war, ist trotzdem eine Person."""
    recently = datetime.now(timezone.utc) - timedelta(days=5)
    for _ in range(3):
        old = _campaign(db, owner, template, emails=("a@example.de",))
        for r in db.query(Recipient).filter(Recipient.campaign_id == old.id):
            r.sent_at = recently
    db.commit()

    campaign = _campaign(db, owner, template, emails=("a@example.de", "neu@example.de"))
    result = preflight.evaluate(db, campaign)
    finding = next(f for f in result["findings"] if f["code"] == "cooldown")
    assert finding["params"]["count"] == 1


def test_cooldown_ignores_older_campaigns(db, owner, template):
    long_ago = datetime.now(timezone.utc) - timedelta(days=90)
    old = _campaign(db, owner, template, emails=("a@example.de",))
    for r in db.query(Recipient).filter(Recipient.campaign_id == old.id):
        r.sent_at = long_ago
    db.commit()

    campaign = _campaign(db, owner, template, emails=("a@example.de",))
    assert "cooldown" not in _codes(preflight.evaluate(db, campaign))


def test_cooldown_zero_disables_the_check(db, owner, template):
    config = preflight.get_config(db)
    config.cooldown_days = 0
    db.commit()
    recently = datetime.now(timezone.utc) - timedelta(days=1)
    old = _campaign(db, owner, template, emails=("a@example.de",))
    for r in db.query(Recipient).filter(Recipient.campaign_id == old.id):
        r.sent_at = recently
    db.commit()

    campaign = _campaign(db, owner, template, emails=("a@example.de",))
    assert "cooldown" not in _codes(preflight.evaluate(db, campaign))


def test_unsent_recipients_do_not_trigger_the_cooldown(db, owner, template):
    """Eine geplante, nie versendete Kampagne hat niemanden behelligt."""
    _campaign(db, owner, template, emails=("a@example.de",))  # sent_at bleibt None
    campaign = _campaign(db, owner, template, emails=("a@example.de",))
    assert "cooldown" not in _codes(preflight.evaluate(db, campaign))


# --- Risikoklasse -----------------------------------------------------------


def test_high_risk_is_flagged_with_the_configured_role(db, owner, template):
    config = preflight.get_config(db)
    config.second_approval_role = "privacy_officer"
    db.commit()
    template.risk_class = "high"
    db.commit()

    result = preflight.evaluate(db, _campaign(db, owner, template))
    finding = next(f for f in result["findings"] if f["code"] == "high_risk")
    assert finding["params"]["role"] == "privacy_officer"
    assert result["requires_second_approval"] is True


def test_low_risk_needs_no_approval(db, owner, template):
    result = preflight.evaluate(db, _campaign(db, owner, template))
    assert result["requires_second_approval"] is False
    assert "high_risk" not in _codes(result)


# --- API und Startsperre ----------------------------------------------------


def test_send_without_acknowledgement_is_blocked(client, db, owner, template, auth_headers):
    campaign = _campaign(db, owner, template)
    res = client.post(f"/campaigns/{campaign.id}/send", headers=auth_headers(owner))
    assert res.status_code == 409
    assert "Preflight" in res.json()["detail"]


def test_acknowledgement_unblocks_the_send(client, db, owner, template, auth_headers):
    campaign = _campaign(db, owner, template)
    ack = client.post(f"/campaigns/{campaign.id}/preflight/ack", headers=auth_headers(owner))
    assert ack.status_code == 200
    assert ack.json()["acknowledged_at"] is not None

    res = client.post(f"/campaigns/{campaign.id}/send", headers=auth_headers(owner))
    # Darf am SMTP scheitern, aber nicht mehr am Preflight.
    assert res.status_code != 409


def test_a_blocking_finding_cannot_be_acknowledged(client, db, owner, template, auth_headers):
    campaign = _campaign(db, owner, template, emails=())
    res = client.post(f"/campaigns/{campaign.id}/preflight/ack", headers=auth_headers(owner))
    assert res.status_code == 409


def test_warnings_can_be_acknowledged(client, db, owner, template, auth_headers):
    """Eine Warnung ist eine Warnung. Die Entscheidung bleibt beim Betreiber -
    er kennt seinen Betrieb besser als das Produkt."""
    now = datetime.now(timezone.utc)
    db.add(BlackoutWindow(label="Sperrzeit", starts_at=now - timedelta(hours=1), ends_at=now + timedelta(hours=2)))
    db.commit()
    campaign = _campaign(db, owner, template)
    assert client.post(f"/campaigns/{campaign.id}/preflight/ack", headers=auth_headers(owner)).status_code == 200


def test_changing_the_campaign_revokes_the_acknowledgement(client, db, owner, template, auth_headers):
    """Die alte Bestaetigung galt fuer einen Stand, den niemand mehr sieht."""
    campaign = _campaign(db, owner, template)
    client.post(f"/campaigns/{campaign.id}/preflight/ack", headers=auth_headers(owner))

    client.patch(f"/campaigns/{campaign.id}", json={"name": "Anders"}, headers=auth_headers(owner))
    db.expire_all()
    assert db.get(Campaign, campaign.id).preflight_ack_at is None
    assert client.post(f"/campaigns/{campaign.id}/send", headers=auth_headers(owner)).status_code == 409


def test_changing_exclusions_revokes_the_acknowledgement(client, db, owner, template, auth_headers):
    campaign = _campaign(db, owner, template)
    group = _group(db, owner, "Ausgenommen", ["b@example.de"])
    client.post(f"/campaigns/{campaign.id}/preflight/ack", headers=auth_headers(owner))

    res = client.put(
        f"/campaigns/{campaign.id}/exclusions",
        json={"group_ids": [str(group.id)]},
        headers=auth_headers(owner),
    )
    assert res.status_code == 200
    db.expire_all()
    assert db.get(Campaign, campaign.id).preflight_ack_at is None


def test_exclusions_roundtrip(client, db, owner, template, auth_headers):
    campaign = _campaign(db, owner, template)
    group = _group(db, owner, "Raus", ["b@example.de"])
    client.put(
        f"/campaigns/{campaign.id}/exclusions",
        json={"group_ids": [str(group.id)]},
        headers=auth_headers(owner),
    )
    listed = client.get(f"/campaigns/{campaign.id}/exclusions", headers=auth_headers(owner)).json()
    assert listed == [str(group.id)]

    client.put(f"/campaigns/{campaign.id}/exclusions", json={"group_ids": []}, headers=auth_headers(owner))
    assert client.get(f"/campaigns/{campaign.id}/exclusions", headers=auth_headers(owner)).json() == []


def test_unknown_group_in_exclusions_is_404(client, db, owner, template, auth_headers):
    import uuid

    campaign = _campaign(db, owner, template)
    res = client.put(
        f"/campaigns/{campaign.id}/exclusions",
        json={"group_ids": [str(uuid.uuid4())]},
        headers=auth_headers(owner),
    )
    assert res.status_code == 404


def test_excluded_recipients_are_not_sent_to(db, owner, template):
    """Der Ausschluss muss beim Versand wirken, nicht nur im Dialog."""
    import asyncio

    from app.services import campaign as campaign_service

    campaign = _campaign(db, owner, template, emails=("a@example.de", "b@example.de"))
    group = _group(db, owner, "Raus", ["b@example.de"])
    from app.models import CampaignGroupExclusion

    db.add(CampaignGroupExclusion(campaign_id=campaign.id, group_id=group.id))
    db.commit()

    seen: list[str] = []

    async def fake_send(**kwargs):
        seen.extend(r["email"] for r in kwargs["recipients"])
        return {"success": 0, "failed": 0, "sent_tokens": [], "failures": []}

    import app.services.campaign as mod

    original = mod.send_campaign_messages
    mod.send_campaign_messages = fake_send
    try:
        # SMTP-Host setzen, damit die Vorpruefung nicht greift.
        from app.services.smtp_config import get_or_create_smtp_config

        smtp = get_or_create_smtp_config(db)
        smtp.host = "smtp.test.local"
        db.commit()
        asyncio.run(campaign_service.send_campaign(db, campaign))
    finally:
        mod.send_campaign_messages = original

    assert seen == ["a@example.de"]


def test_preflight_endpoint_shape(client, db, owner, template, auth_headers):
    campaign = _campaign(db, owner, template)
    body = client.get(f"/campaigns/{campaign.id}/preflight", headers=auth_headers(owner)).json()
    assert set(body) >= {
        "recipients_total",
        "recipients_effective",
        "groups",
        "risk_class",
        "requires_second_approval",
        "findings",
        "blocked",
    }
