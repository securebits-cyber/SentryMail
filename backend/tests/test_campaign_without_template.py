# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Kampagnen ohne Mail-Vorlage.

Die Vorlage war bis hierher beim Anlegen Pflicht. Fuer Kampagnen ohne
Mailversand - allen voran der USB-Drop - ist das falsch: Es gibt keinen
Betreff, kein HTML und keinen Absender, und man musste trotzdem eine
beliebige Vorlage auswaehlen, damit das Anlegen durchging.

Die Bedingung liegt jetzt beim Versand. Diese Tests halten beide Haelften
fest: dass das Anlegen ohne Vorlage geht **und** dass ein Mailversand ohne
Vorlage sauber abgelehnt wird statt in einen AttributeError zu laufen.
"""
import pytest

from app.models import Campaign, Recipient, Template
from app.services.campaign import TemplateMissingError, send_campaign
from app.utils.security import generate_tracking_token


@pytest.fixture
def owner(make_user):
    return make_user(email="cwt-owner@example.com")


@pytest.fixture
def template(db, owner):
    row = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=owner.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _campaign(db, owner, *, template=None):
    row = Campaign(
        name="USB-Simulation",
        template_id=template.id if template else None,
        created_by_id=owner.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# --- Anlegen ----------------------------------------------------------------


def test_a_campaign_can_be_stored_without_a_template(db, owner):
    """Der eigentliche Zweck: ein USB-Drop braucht keine Mail-Vorlage."""
    campaign = _campaign(db, owner)
    assert campaign.template_id is None
    assert campaign.template is None


def test_the_api_accepts_a_creation_without_a_template(client, make_user, auth_headers):
    admin = make_user(email="cwt-admin@example.com")
    res = client.post(
        "/campaigns",
        json={"name": "Datentraeger Q3", "group_ids": [], "recipients": []},
        headers=auth_headers(admin),
    )
    assert res.status_code in (200, 201), res.text
    assert res.json()["template_id"] is None


def test_a_mail_campaign_still_takes_its_template(client, db, template, make_user, auth_headers):
    """Die Aenderung darf den bestehenden Weg nicht verstellen."""
    admin = make_user(email="cwt-admin2@example.com")
    res = client.post(
        "/campaigns",
        json={"name": "Mail", "template_id": str(template.id), "group_ids": [], "recipients": []},
        headers=auth_headers(admin),
    )
    assert res.status_code in (200, 201), res.text
    assert res.json()["template_id"] == str(template.id)


# --- Versand ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_sending_without_a_template_is_refused_with_a_reason(db, owner):
    """Ohne diese Pruefung liefe der Versand in einen AttributeError - also 500
    statt einer Auskunft, die dem Betreiber sagt, was fehlt."""
    campaign = _campaign(db, owner)
    db.add(
        Recipient(
            campaign_id=campaign.id,
            email="jemand@example.de",
            tracking_token=generate_tracking_token(),
        )
    )
    db.commit()

    with pytest.raises(TemplateMissingError):
        await send_campaign(db, campaign)


@pytest.mark.asyncio
async def test_the_check_runs_before_anything_is_sent(db, owner, monkeypatch):
    """Die Pruefung steht vor der SMTP-Ermittlung: Ein fehlender Absender darf
    nicht die erste Meldung sein, wenn schon die Vorlage fehlt."""
    import app.services.campaign as mod

    def _boom(*_a, **_kw):
        raise AssertionError("smtp_params haette nicht aufgerufen werden duerfen")

    monkeypatch.setattr(mod, "smtp_params", _boom)

    with pytest.raises(TemplateMissingError):
        await send_campaign(db, _campaign(db, owner))
