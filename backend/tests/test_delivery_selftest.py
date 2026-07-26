# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zustell-Selbsttest gegen ein Kanarienpostfach (Welle 9.1).

Zwei Zusagen stehen hier im Mittelpunkt, weil sie leicht unbemerkt kippen:
Der Test blockiert nie den Kampagnenstart, und ein IMAP-Problem faerbt niemals
auf das Zustellergebnis ab.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from app.models import Campaign, DeliverySelfTest, Template, UserRole
from app.services import delivery_selftest as svc
from app.utils.crypto import decrypt


@pytest.fixture
def campaign(db, make_user):
    user = make_user(email="deliv-owner@example.com")
    template = Template(
        name="T", subject="S", html_content="<p>x</p>", created_by_id=user.id
    )
    db.add(template)
    db.flush()
    row = Campaign(name="Testkampagne", template_id=template.id, created_by_id=user.id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@pytest.fixture
def configured(db):
    config = svc.get_config(db)
    config.canary_address = "kanarienvogel@example.de"
    config.imap_host = "imap.example.de"
    config.imap_username = "kanarienvogel"
    db.commit()
    return config


# --- Konfiguration ----------------------------------------------------------


def test_without_canary_the_test_is_unavailable(db):
    """Ohne Kanarienpostfach entfaellt der Test kommentarlos - er ist eine
    Hilfe, keine Voraussetzung."""
    assert svc.is_configured(db) is False


def test_config_endpoint_never_returns_the_password(client, db, make_user, auth_headers):
    admin = make_user(email="deliv-cfg@example.com")
    res = client.put(
        "/delivery/config",
        json={
            "canary_address": "kanarienvogel@example.de",
            "imap_host": "imap.example.de",
            "imap_port": 993,
            "imap_username": "kv",
            "imap_password": "streng-geheim",
            "imap_use_ssl": True,
            "imap_mailbox": "INBOX",
        },
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    assert res.json()["has_imap_password"] is True
    assert "streng-geheim" not in res.text
    # In der DB verschluesselt, nicht im Klartext.
    stored = svc.get_config(db).imap_password_encrypted
    assert stored and stored != "streng-geheim"
    assert decrypt(stored) == "streng-geheim"


def test_saving_without_password_keeps_the_existing_one(client, db, make_user, auth_headers):
    """None = unveraendert. Ohne diese Unterscheidung verliert jedes Speichern
    der Seite das Passwort, weil das Frontend es nie zurueckbekommt."""
    admin = make_user(email="deliv-cfg2@example.com")
    base = {
        "canary_address": "kv@example.de",
        "imap_host": "imap.example.de",
        "imap_port": 993,
        "imap_username": "kv",
        "imap_use_ssl": True,
        "imap_mailbox": "INBOX",
    }
    client.put("/delivery/config", json={**base, "imap_password": "geheim"}, headers=auth_headers(admin))
    client.put("/delivery/config", json={**base, "imap_mailbox": "Andere"}, headers=auth_headers(admin))

    db.expire_all()
    config = svc.get_config(db)
    assert config.imap_mailbox == "Andere"
    assert decrypt(config.imap_password_encrypted) == "geheim"


def test_empty_password_clears_it(client, db, make_user, auth_headers):
    admin = make_user(email="deliv-cfg3@example.com")
    base = {
        "canary_address": "kv@example.de",
        "imap_host": "imap.example.de",
        "imap_port": 993,
        "imap_username": "kv",
        "imap_use_ssl": True,
        "imap_mailbox": "INBOX",
    }
    client.put("/delivery/config", json={**base, "imap_password": "geheim"}, headers=auth_headers(admin))
    client.put("/delivery/config", json={**base, "imap_password": ""}, headers=auth_headers(admin))

    db.expire_all()
    assert svc.get_config(db).imap_password_encrypted is None


def test_config_requires_admin(client, make_user, auth_headers):
    user = make_user(email="deliv-plain2@example.com", role=UserRole.USER)
    assert client.get("/delivery/config", headers=auth_headers(user)).status_code == 403


# --- Probemail --------------------------------------------------------------


def test_probe_records_smtp_failure_instead_of_raising(client, db, make_user, auth_headers, campaign, configured, monkeypatch):
    """Die Fehlermeldung des SMTP-Servers ist der wertvollste Teil der Diagnose
    und darf nicht in einem Stacktrace verschwinden."""

    async def boom(**_kwargs):
        raise OSError("Connection refused")

    monkeypatch.setattr(svc, "send_simple_email", boom)

    admin = make_user(email="deliv-probe@example.com")
    res = client.post(f"/delivery/selftest/{campaign.id}", headers=auth_headers(admin))
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "failed"
    assert "Connection refused" in body["error"]


def test_probe_uses_the_campaign_route(db, campaign, configured, monkeypatch):
    """Ein Test ueber einen anderen Absender wuerde genau das nicht pruefen,
    worum es geht."""
    captured = {}

    async def capture(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(svc, "send_simple_email", capture)

    record = asyncio.run(svc.run_probe(db, campaign))
    assert captured["to_email"] == "kanarienvogel@example.de"
    assert record.token in captured["subject"]
    assert record.status == "pending"
    assert record.route == "Globales Fallback-SMTP"


def test_selftest_without_canary_is_409(client, make_user, auth_headers, campaign):
    admin = make_user(email="deliv-probe2@example.com")
    res = client.post(f"/delivery/selftest/{campaign.id}", headers=auth_headers(admin))
    assert res.status_code == 409


# --- Nachpruefung -----------------------------------------------------------


def _pending(db, campaign, *, age_minutes=0):
    record = DeliverySelfTest(
        campaign_id=campaign.id,
        token="abc123",
        status="pending",
        route="Test",
        sent_at=datetime.now(timezone.utc) - timedelta(minutes=age_minutes),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def test_found_in_canary_passes(db, campaign, configured, monkeypatch):
    monkeypatch.setattr(svc, "_search_canary", lambda *_a, **_k: True)
    record = svc.poll(db, _pending(db, campaign))
    assert record.status == "passed"
    assert record.detected_at is not None


def test_imap_failure_never_marks_delivery_as_failed(db, campaign, configured, monkeypatch):
    """Ein IMAP-Problem ist kein Zustellfehler. Alles andere wuerde ein
    funktionierendes Gateway faelschlich anschwaerzen."""

    def boom(*_a, **_k):
        raise OSError("IMAP unreachable")

    monkeypatch.setattr(svc, "_search_canary", boom)
    record = svc.poll(db, _pending(db, campaign, age_minutes=120))
    assert record.status == "pending"
    assert "IMAP" in record.error


def test_not_found_within_grace_stays_pending(db, campaign, configured, monkeypatch):
    """Greylisting verzoegert regelmaessig um Minuten - kuerzer wuerde den
    haeufigsten Normalfall als Fehler melden."""
    monkeypatch.setattr(svc, "_search_canary", lambda *_a, **_k: False)
    record = svc.poll(db, _pending(db, campaign, age_minutes=5))
    assert record.status == "pending"


def test_not_found_after_grace_fails(db, campaign, configured, monkeypatch):
    monkeypatch.setattr(svc, "_search_canary", lambda *_a, **_k: False)
    record = svc.poll(db, _pending(db, campaign, age_minutes=45))
    assert record.status == "failed"


def test_poll_without_imap_leaves_it_open(db, campaign):
    """Ohne IMAP gibt es nichts zu pruefen - der Test darf weder bestehen noch
    durchfallen."""
    config = svc.get_config(db)
    config.canary_address = "kv@example.de"
    config.imap_host = ""
    db.commit()
    record = svc.poll(db, _pending(db, campaign, age_minutes=120))
    assert record.status == "pending"


def test_completed_tests_are_not_rechecked(db, campaign, configured, monkeypatch):
    """Das Ergebnis ist ein Befund zu einem Zeitpunkt, kein Live-Zustand."""

    def fail(*_a, **_k):
        raise AssertionError("darf nicht erneut geprueft werden")

    monkeypatch.setattr(svc, "_search_canary", fail)
    record = _pending(db, campaign)
    record.status = "passed"
    db.commit()
    assert svc.poll(db, record).status == "passed"


# --- Der Test blockiert nie -------------------------------------------------


def test_campaign_send_is_not_blocked_by_a_failed_selftest(client, db, make_user, auth_headers, campaign, configured):
    """Ein Fehlschlag warnt, er blockiert nicht. Die Entscheidung bleibt beim
    Betreiber, der sein Gateway besser kennt als wir."""
    record = _pending(db, campaign)
    record.status = "failed"
    record.error = "nicht angekommen"
    db.commit()

    admin = make_user(email="deliv-send@example.com")
    res = client.post(f"/campaigns/{campaign.id}/send", headers=auth_headers(admin))
    # Der Versand darf an SMTP scheitern, aber nicht am Selbsttest.
    assert res.status_code != 409


def test_reading_the_selftest_requires_admin(client, make_user, auth_headers, campaign):
    """Die Antwort nennt Versandweg und ggf. SMTP-/IMAP-Fehlertexte - interne
    Infrastruktur. Ausserdem loest der Aufruf ein IMAP-Polling aus."""
    user = make_user(email="deliv-read-plain@example.com", role=UserRole.USER)
    res = client.get(f"/delivery/selftest/{campaign.id}", headers=auth_headers(user))
    assert res.status_code == 403
