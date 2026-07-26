# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zustelldiagnose (Welle 9.1).

DNS wird durchgehend gefaked - ein Test, der echte Aufloesung braucht, ist im
CI wertlos und beim Kunden erst recht.
"""
from datetime import datetime, timezone

import dns.resolver
import pytest

from app.models import Campaign, Recipient, Template, UserRole
from app.services import delivery_diag as diag


@pytest.fixture
def campaign(db, make_user):
    user = make_user(email="diag-owner@example.com")
    template = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=user.id)
    db.add(template)
    db.flush()
    row = Campaign(name="Diagnose", template_id=template.id, created_by_id=user.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _recipient(db, campaign, token, *, status=None, code=None, sent=False):
    row = Recipient(
        campaign_id=campaign.id,
        email=f"{token}@example.de",
        tracking_token=token,
        delivery_status=status,
        delivery_code=code,
        sent_at=datetime.now(timezone.utc) if sent else None,
    )
    db.add(row)
    db.commit()
    return row


def _codes(findings):
    return [f["code"] for f in findings]


# --- DNS --------------------------------------------------------------------


def _fake_txt(monkeypatch, mapping):
    """Ersetzt die TXT-Aufloesung durch eine Tabelle."""
    monkeypatch.setattr(diag, "_txt_records", lambda name: mapping.get(name, []))


def test_missing_spf_is_an_error(monkeypatch):
    _fake_txt(monkeypatch, {})
    codes = _codes(diag.check_domain("sim.example.de"))
    assert "spf_missing" in codes
    assert "dmarc_missing" in codes


def test_multiple_spf_records_are_an_error(monkeypatch):
    """Mehrere SPF-Eintraege sind laut RFC 7208 ungueltig - viele Empfaenger
    lehnen die Domain dann als permerror ab."""
    _fake_txt(monkeypatch, {"sim.example.de": ["v=spf1 include:a -all", "v=spf1 include:b -all"]})
    assert "spf_multiple" in _codes(diag.check_domain("sim.example.de"))


@pytest.mark.parametrize(
    "record,expected",
    [
        ("v=spf1 include:a -all", "spf_strict"),
        ("v=spf1 include:a ~all", "spf_softfail"),
        ("v=spf1 include:a +all", "spf_permissive"),
        ("v=spf1 include:a", "spf_no_all"),
    ],
)
def test_spf_policy_is_classified(monkeypatch, record, expected):
    _fake_txt(monkeypatch, {"sim.example.de": [record]})
    assert expected in _codes(diag.check_domain("sim.example.de"))


@pytest.mark.parametrize(
    "policy,expected",
    [("reject", "dmarc_reject"), ("quarantine", "dmarc_quarantine"), ("none", "dmarc_none")],
)
def test_dmarc_policy_is_classified(monkeypatch, policy, expected):
    _fake_txt(
        monkeypatch,
        {
            "sim.example.de": ["v=spf1 -all"],
            "_dmarc.sim.example.de": [f"v=DMARC1; p={policy}; rua=mailto:x@example.de"],
        },
    )
    assert expected in _codes(diag.check_domain("sim.example.de"))


def test_dkim_is_reported_as_unverifiable(monkeypatch):
    """Ohne den Selektor laesst sich DKIM nicht pruefen. Lieber sagen, dass es
    nicht geprueft wurde, als eine Pruefung vortaeuschen."""
    _fake_txt(monkeypatch, {})
    assert "dkim_unverifiable" in _codes(diag.check_domain("sim.example.de"))


def test_dns_failure_does_not_raise(monkeypatch):
    """Ein haengender Resolver darf die Oberflaeche nicht mitreissen."""

    def boom(*_a, **_k):
        raise dns.resolver.NoNameservers()

    monkeypatch.setattr(dns.resolver.Resolver, "resolve", boom)
    codes = _codes(diag.check_domain("sim.example.de"))
    assert "spf_missing" in codes  # kein Befund = wie kein Eintrag, aber kein Absturz


def test_unknown_domain_is_flagged(monkeypatch):
    assert _codes(diag.check_domain("")) == ["domain_unknown"]


def test_long_txt_chunks_are_joined(monkeypatch):
    """TXT-Werte kommen in Haeppchen zu 255 Zeichen. Unverbunden waere ein
    langer SPF-Eintrag abgeschnitten und wuerde falsch bewertet."""

    class Answer:
        strings = (b"v=spf1 include:sehr-langer-eintrag.example.de ", b"-all")

    monkeypatch.setattr(dns.resolver.Resolver, "resolve", lambda *_a, **_k: [Answer()])
    assert diag._txt_records("x.example.de") == [
        "v=spf1 include:sehr-langer-eintrag.example.de -all"
    ]


# --- Zustellung -------------------------------------------------------------


def test_greylisting_is_recognised_not_reported_as_lost(db, campaign):
    """Wer hier "nicht angekommen" liest, sucht an der falschen Stelle: Die
    Mail ist verzoegert, nicht verloren."""
    for i in range(4):
        _recipient(db, campaign, f"grey{i}", status="deferred", code=451)
    findings, stats = diag.check_deliveries(db, campaign)
    assert "greylisting_suspected" in _codes(findings)
    assert "permanent_failures" not in _codes(findings)
    assert stats["deferred"] == 4


def test_few_deferrals_are_not_called_greylisting(db, campaign):
    """Einzelne 4xx sind Alltag - erst die Haeufung ist ein Muster."""
    _recipient(db, campaign, "grey1", status="deferred", code=451)
    findings, _ = diag.check_deliveries(db, campaign)
    assert "greylisting_suspected" not in _codes(findings)
    assert "deferred_some" in _codes(findings)


def test_permanent_failures_are_an_error(db, campaign):
    _recipient(db, campaign, "hart", status="failed", code=550)
    findings, stats = diag.check_deliveries(db, campaign)
    assert "permanent_failures" in _codes(findings)
    assert stats["codes"] == {550: 1}


def test_all_delivered_is_reported(db, campaign):
    for i in range(3):
        _recipient(db, campaign, f"ok{i}", status="sent", sent=True)
    findings, stats = diag.check_deliveries(db, campaign)
    assert "all_delivered" in _codes(findings)
    assert stats["sent"] == 3


def test_not_sent_yet_is_not_a_failure(db, campaign):
    """Bestandsdaten vor dieser Version haben keinen Status - das ist kein
    Zustellfehler und darf nicht so aussehen."""
    _recipient(db, campaign, "alt")
    findings, _ = diag.check_deliveries(db, campaign)
    assert _codes(findings) == ["not_sent_yet"]


def test_campaign_without_recipients(db, campaign):
    findings, stats = diag.check_deliveries(db, campaign)
    assert _codes(findings) == ["no_recipients"]
    assert stats["total"] == 0


# --- API --------------------------------------------------------------------


def test_diagnosis_endpoint(client, db, campaign, make_user, auth_headers, monkeypatch):
    _fake_txt(monkeypatch, {"example.com": ["v=spf1 -all"]})
    _recipient(db, campaign, "e1", status="failed", code=550)

    admin = make_user(email="diag-admin@example.com")
    res = client.get(f"/delivery/diagnosis/{campaign.id}", headers=auth_headers(admin))
    assert res.status_code == 200
    body = res.json()
    assert body["stats"]["failed"] == 1
    assert "permanent_failures" in [f["code"] for f in body["delivery"]]


def test_diagnosis_requires_admin(client, campaign, make_user, auth_headers):
    user = make_user(email="diag-plain@example.com", role=UserRole.USER)
    res = client.get(f"/delivery/diagnosis/{campaign.id}", headers=auth_headers(user))
    assert res.status_code == 403


def test_diagnosis_unknown_campaign_is_404(client, make_user, auth_headers):
    import uuid

    admin = make_user(email="diag-admin2@example.com")
    res = client.get(f"/delivery/diagnosis/{uuid.uuid4()}", headers=auth_headers(admin))
    assert res.status_code == 404
