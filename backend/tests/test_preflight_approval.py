# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zweitfreigabe bei hoher Risikoklasse (Welle 9.2, Schritt C).

Der Kern ist die Trennung von Antragsteller und Entscheider. Sie ist an drei
Stellen gesichert - hier wird jede einzeln geprueft, damit keine davon
unbemerkt wegfaellt.
"""
import pytest

from app.models import (
    Campaign,
    CampaignApproval,
    CampaignApprovalStatus,
    Recipient,
    Template,
    UserRole,
)
from app.services import preflight
from app.utils.security import generate_tracking_token

REASON = "Gehaltsvorwand fuer die Buchhaltung, mit dem Personalrat abgestimmt."


@pytest.fixture
def admin(make_user):
    return make_user(email="appr-admin@example.com")


@pytest.fixture
def other_admin(make_user):
    return make_user(email="appr-admin2@example.com")


@pytest.fixture
def officer(make_user):
    return make_user(email="appr-officer@example.com", role=UserRole.PRIVACY_OFFICER)


@pytest.fixture
def high_risk_campaign(db, admin):
    template = Template(
        name="Gehalt", subject="Gehaltsabrechnung", html_content="<p>x</p>",
        created_by_id=admin.id, risk_class="high",
    )
    db.add(template)
    db.flush()
    campaign = Campaign(name="Gehaltskampagne", template_id=template.id, created_by_id=admin.id)
    db.add(campaign)
    db.flush()
    db.add(
        Recipient(campaign_id=campaign.id, email="a@example.de", tracking_token=generate_tracking_token())
    )
    db.commit()
    db.refresh(campaign)
    return campaign


def _request(client, campaign, user, auth_headers):
    return client.post(
        f"/campaigns/{campaign.id}/approval", json={"reason": REASON}, headers=auth_headers(user)
    )


# --- Wer braucht ueberhaupt eine Freigabe -----------------------------------


def test_low_risk_campaign_needs_no_approval(db, admin):
    template = Template(name="Paket", subject="S", html_content="<p>x</p>", created_by_id=admin.id)
    db.add(template)
    db.flush()
    campaign = Campaign(name="Harmlos", template_id=template.id, created_by_id=admin.id)
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    assert preflight.has_valid_approval(db, campaign) is True


def test_requesting_for_a_low_risk_campaign_is_rejected(client, db, admin, auth_headers):
    """Sonst muesste jede harmlose Kampagne durch ein Verfahren, das fuer sie
    nicht gedacht ist."""
    template = Template(name="Paket", subject="S", html_content="<p>x</p>", created_by_id=admin.id)
    db.add(template)
    db.flush()
    campaign = Campaign(name="Harmlos", template_id=template.id, created_by_id=admin.id)
    db.add(campaign)
    db.commit()
    assert _request(client, campaign, admin, auth_headers).status_code == 409


# --- Vier-Augen-Prinzip -----------------------------------------------------


def test_requester_cannot_decide_their_own_request(client, db, admin, high_risk_campaign, auth_headers):
    """Der ganze Zweck der Uebung."""
    created = _request(client, high_risk_campaign, admin, auth_headers).json()
    res = client.patch(
        f"/campaigns/{high_risk_campaign.id}/approval/{created['id']}",
        json={"approve": True},
        headers=auth_headers(admin),
    )
    assert res.status_code == 403
    assert "beantragt" in res.json()["detail"]


def test_another_admin_may_decide(client, db, admin, other_admin, high_risk_campaign, auth_headers):
    created = _request(client, high_risk_campaign, admin, auth_headers).json()
    res = client.patch(
        f"/campaigns/{high_risk_campaign.id}/approval/{created['id']}",
        json={"approve": True, "note": "Mit dem Personalrat besprochen."},
        headers=auth_headers(other_admin),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "approved"
    assert res.json()["decided_by_email"] == other_admin.email


def test_wrong_role_may_not_decide(client, db, admin, officer, high_risk_campaign, auth_headers):
    """Steht die Freigabe beim Admin, entscheidet nicht der Datenschutzbeauftragte."""
    created = _request(client, high_risk_campaign, admin, auth_headers).json()
    res = client.patch(
        f"/campaigns/{high_risk_campaign.id}/approval/{created['id']}",
        json={"approve": True},
        headers=auth_headers(officer),
    )
    assert res.status_code == 403


def test_officer_decides_when_configured(client, db, admin, officer, high_risk_campaign, auth_headers):
    """Auf die Betriebsratsrolle gelegt - die vorgesehene Verzahnung mit Welle 2."""
    config = preflight.get_config(db)
    config.second_approval_role = "privacy_officer"
    db.commit()

    created = _request(client, high_risk_campaign, admin, auth_headers).json()
    res = client.patch(
        f"/campaigns/{high_risk_campaign.id}/approval/{created['id']}",
        json={"approve": True},
        headers=auth_headers(officer),
    )
    assert res.status_code == 200


def test_database_rejects_self_approval(db, admin, high_risk_campaign):
    """Die Regel haengt nicht allein an der Anwendungslogik."""
    from sqlalchemy.exc import IntegrityError

    row = CampaignApproval(
        campaign_id=high_risk_campaign.id,
        requested_by_id=admin.id,
        requested_by_email=admin.email,
        reason=REASON,
        status=CampaignApprovalStatus.APPROVED,
        decided_by_id=admin.id,
    )
    db.add(row)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


# --- Verfahren --------------------------------------------------------------


def test_reason_is_mandatory(client, high_risk_campaign, admin, auth_headers):
    """Eine Freigabe ohne Anlass waere eine Formalie."""
    res = client.post(
        f"/campaigns/{high_risk_campaign.id}/approval",
        json={"reason": "kurz"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 422


def test_only_one_open_request_at_a_time(client, high_risk_campaign, admin, auth_headers):
    assert _request(client, high_risk_campaign, admin, auth_headers).status_code == 201
    assert _request(client, high_risk_campaign, admin, auth_headers).status_code == 409


def test_a_decided_request_cannot_be_decided_again(
    client, high_risk_campaign, admin, other_admin, auth_headers
):
    created = _request(client, high_risk_campaign, admin, auth_headers).json()
    url = f"/campaigns/{high_risk_campaign.id}/approval/{created['id']}"
    client.patch(url, json={"approve": True}, headers=auth_headers(other_admin))
    res = client.patch(url, json={"approve": False}, headers=auth_headers(other_admin))
    assert res.status_code == 409


def test_rejection_is_recorded_with_its_note(
    client, high_risk_campaign, admin, other_admin, auth_headers
):
    created = _request(client, high_risk_campaign, admin, auth_headers).json()
    res = client.patch(
        f"/campaigns/{high_risk_campaign.id}/approval/{created['id']}",
        json={"approve": False, "note": "Zeitpunkt ungeeignet, Umstrukturierung laeuft."},
        headers=auth_headers(other_admin),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
    assert "Umstrukturierung" in res.json()["note"]


# --- Wirkung auf Preflight und Versand --------------------------------------


def test_high_risk_blocks_until_approved(db, high_risk_campaign):
    result = preflight.evaluate(db, high_risk_campaign)
    assert "approval_missing" in [f["code"] for f in result["findings"]]
    assert result["blocked"] is True


def test_pending_request_still_blocks(client, db, high_risk_campaign, admin, auth_headers):
    _request(client, high_risk_campaign, admin, auth_headers)
    db.expire_all()
    result = preflight.evaluate(db, db.get(Campaign, high_risk_campaign.id))
    assert "approval_pending" in [f["code"] for f in result["findings"]]
    assert result["blocked"] is True


def test_rejection_blocks_and_says_so(client, db, high_risk_campaign, admin, other_admin, auth_headers):
    created = _request(client, high_risk_campaign, admin, auth_headers).json()
    client.patch(
        f"/campaigns/{high_risk_campaign.id}/approval/{created['id']}",
        json={"approve": False},
        headers=auth_headers(other_admin),
    )
    db.expire_all()
    result = preflight.evaluate(db, db.get(Campaign, high_risk_campaign.id))
    assert "approval_rejected" in [f["code"] for f in result["findings"]]


def test_approval_unblocks_the_send(client, db, high_risk_campaign, admin, other_admin, auth_headers):
    created = _request(client, high_risk_campaign, admin, auth_headers).json()
    client.patch(
        f"/campaigns/{high_risk_campaign.id}/approval/{created['id']}",
        json={"approve": True},
        headers=auth_headers(other_admin),
    )
    ack = client.post(f"/campaigns/{high_risk_campaign.id}/preflight/ack", headers=auth_headers(admin))
    assert ack.status_code == 200
    assert ack.json()["approval_granted"] is True

    res = client.post(f"/campaigns/{high_risk_campaign.id}/send", headers=auth_headers(admin))
    assert res.status_code != 409


def test_send_is_blocked_without_approval_even_with_acknowledgement(
    client, db, high_risk_campaign, admin, auth_headers
):
    """Zweite Absicherung: Die Risikoklasse haengt an der Vorlage und kann sich
    nach der Bestaetigung geaendert haben."""
    high_risk_campaign.preflight_ack_at = __import__("datetime").datetime.now(
        __import__("datetime").timezone.utc
    )
    db.commit()
    res = client.post(f"/campaigns/{high_risk_campaign.id}/send", headers=auth_headers(admin))
    assert res.status_code == 409
    assert "Zweitfreigabe" in res.json()["detail"]


def test_changing_the_template_revokes_an_approval(
    client, db, high_risk_campaign, admin, other_admin, auth_headers
):
    """Eine andere Vorlage ist ein anderer Koeder - moeglicherweise mit anderer
    Risikoklasse."""
    created = _request(client, high_risk_campaign, admin, auth_headers).json()
    client.patch(
        f"/campaigns/{high_risk_campaign.id}/approval/{created['id']}",
        json={"approve": True},
        headers=auth_headers(other_admin),
    )

    other = Template(
        name="Andere", subject="S", html_content="<p>y</p>", created_by_id=admin.id, risk_class="high"
    )
    db.add(other)
    db.commit()
    client.patch(
        f"/campaigns/{high_risk_campaign.id}",
        json={"template_id": str(other.id)},
        headers=auth_headers(admin),
    )
    db.expire_all()
    assert preflight.has_valid_approval(db, db.get(Campaign, high_risk_campaign.id)) is False


def test_renaming_keeps_the_approval(
    client, db, high_risk_campaign, admin, other_admin, auth_headers
):
    """Eine reine Umbenennung ist kein anderer Koeder - sonst waere das
    Verfahren eine Schikane."""
    created = _request(client, high_risk_campaign, admin, auth_headers).json()
    client.patch(
        f"/campaigns/{high_risk_campaign.id}/approval/{created['id']}",
        json={"approve": True},
        headers=auth_headers(other_admin),
    )
    client.patch(
        f"/campaigns/{high_risk_campaign.id}", json={"name": "Neuer Name"}, headers=auth_headers(admin)
    )
    db.expire_all()
    assert preflight.has_valid_approval(db, db.get(Campaign, high_risk_campaign.id)) is True
