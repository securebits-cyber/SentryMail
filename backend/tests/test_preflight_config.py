# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Regeln des Blast-Radius-Preflights (Welle 9.2, Schritt A).

Schwerpunkt: die Zeitrechnung. Ruhezeiten ueber Mitternacht und Zeitzonen sind
die Stellen, an denen eine naive Implementierung still das Falsche tut - und
zwar so, dass es im Normalbetrieb monatelang niemandem auffaellt.
"""
import json
from datetime import datetime, time, timedelta, timezone

import pytest

from app.models import BlackoutWindow, PreflightConfig, Template, UserRole
from app.services import preflight


@pytest.fixture
def config(db):
    row = preflight.get_config(db)
    row.timezone = "Europe/Berlin"
    db.commit()
    return row


# --- Ruhezeiten -------------------------------------------------------------


def _at(config, hour, minute=0, tz="Europe/Berlin"):
    """Ein Zeitpunkt in der Instanz-Zeitzone, als aware UTC uebergeben."""
    from zoneinfo import ZoneInfo

    local = datetime(2026, 7, 15, hour, minute, tzinfo=ZoneInfo(tz))
    return local.astimezone(timezone.utc)


def test_without_quiet_hours_nothing_is_blocked(db, config):
    assert preflight.in_quiet_hours(config, _at(config, 3)) is False


@pytest.mark.parametrize(
    "hour,expected",
    [(8, False), (9, True), (12, True), (16, True), (17, False), (23, False)],
)
def test_daytime_window(db, config, hour, expected):
    """Fenster 09:00-17:00 - der einfache Fall."""
    config.quiet_hours_start = time(9, 0)
    config.quiet_hours_end = time(17, 0)
    db.commit()
    assert preflight.in_quiet_hours(config, _at(config, hour)) is expected


@pytest.mark.parametrize(
    "hour,expected",
    [(21, False), (22, True), (23, True), (0, True), (3, True), (5, True), (6, False), (12, False)],
)
def test_window_across_midnight(db, config, hour, expected):
    """22:00-06:00 ist der Normalfall fuer Ruhezeiten.

    Die naive Variante ``start <= t < end`` waere hier immer False - die
    Ruhezeiten haetten nie gegriffen und niemand haette es gemerkt.
    """
    config.quiet_hours_start = time(22, 0)
    config.quiet_hours_end = time(6, 0)
    db.commit()
    assert preflight.in_quiet_hours(config, _at(config, hour)) is expected


def test_quiet_hours_use_the_configured_timezone(db, config):
    """03:00 UTC ist 05:00 in Berlin - also noch Ruhezeit, obwohl es in UTC
    ausserhalb des Fensters laege, wenn man es dort auswertete."""
    config.quiet_hours_start = time(22, 0)
    config.quiet_hours_end = time(6, 0)
    db.commit()
    moment = datetime(2026, 7, 15, 3, 0, tzinfo=timezone.utc)
    assert preflight.in_quiet_hours(config, moment) is True

    config.timezone = "UTC"
    db.commit()
    assert preflight.in_quiet_hours(config, moment) is True  # 03:00 UTC liegt auch dort im Fenster

    moment = datetime(2026, 7, 15, 7, 0, tzinfo=timezone.utc)  # 09:00 Berlin
    config.timezone = "Europe/Berlin"
    db.commit()
    assert preflight.in_quiet_hours(config, moment) is False


def test_identical_start_and_end_means_off(db, config):
    """Ein Fenster von 00:00 bis 00:00 ist entweder nichts oder alles -
    als 'aus' zu lesen ist die einzige harmlose Auslegung."""
    config.quiet_hours_start = time(0, 0)
    config.quiet_hours_end = time(0, 0)
    db.commit()
    assert preflight.in_quiet_hours(config, _at(config, 3)) is False


def test_unknown_timezone_falls_back_to_utc_instead_of_failing(db, config):
    """Eine falsche Zeitzone ist ein Konfigurationsfehler und darf den
    Kampagnenstart nicht blockieren."""
    config.timezone = "Mars/Olympus_Mons"
    db.commit()
    assert preflight.in_quiet_hours(config, _at(config, 3)) is False  # kein Absturz
    assert preflight.resolve_timezone("Mars/Olympus_Mons").key == "UTC"


def test_timezone_validation():
    assert preflight.is_valid_timezone("Europe/Berlin") is True
    assert preflight.is_valid_timezone("UTC") is True
    assert preflight.is_valid_timezone("Nicht/Existent") is False


# --- Sperrfenster -----------------------------------------------------------


def _window(db, label, start_offset_h, end_offset_h):
    now = datetime.now(timezone.utc)
    row = BlackoutWindow(
        label=label,
        starts_at=now + timedelta(hours=start_offset_h),
        ends_at=now + timedelta(hours=end_offset_h),
    )
    db.add(row)
    db.commit()
    return row


def test_active_blackout_is_found(db):
    _window(db, "Betriebsversammlung", -1, 1)
    now = datetime.now(timezone.utc)
    assert preflight.active_blackout(db, now).label == "Betriebsversammlung"


def test_past_and_future_windows_are_not_active(db):
    _window(db, "Vorbei", -5, -3)
    _window(db, "Kommt noch", 3, 5)
    assert preflight.active_blackout(db, datetime.now(timezone.utc)) is None


def test_upcoming_blackouts_are_listed(db):
    _window(db, "Bald", 2, 4)
    _window(db, "Spaeter", 200, 202)
    now = datetime.now(timezone.utc)
    upcoming = preflight.upcoming_blackouts(db, now, timedelta(days=1))
    assert [w.label for w in upcoming] == ["Bald"]


# --- Risikoklasse -----------------------------------------------------------


def test_only_high_requires_a_second_approval():
    """Wuerde jede Klasse eine Freigabe erzwingen, wird sie zur Formalie, die
    man wegklickt - und verliert genau die Wirkung, um die es geht."""
    assert preflight.requires_second_approval("high") is True
    assert preflight.requires_second_approval("medium") is False
    assert preflight.requires_second_approval("low") is False


def test_risk_themes_ship_all_three_classes():
    classes = preflight.risk_themes()
    assert [c["id"] for c in classes] == ["high", "medium", "low"]
    for entry in classes:
        assert set(entry["label"]) == {"de", "en"}
        assert set(entry["description"]) == {"de", "en"}
        assert len(entry["themes"]["de"]) == len(entry["themes"]["en"]), (
            "DE und EN muessen gleich viele Themen haben"
        )


def test_missing_theme_file_does_not_disable_the_feature(monkeypatch, tmp_path):
    """Ohne Themenliste bleibt die Klassifizierung nutzbar, nur ohne Vorschlaege."""
    monkeypatch.setattr(preflight, "THEMES_FILE", tmp_path / "gibt-es-nicht.json")
    preflight.reset_cache()
    assert preflight.risk_themes() == []
    preflight.reset_cache()


def test_template_defaults_to_low_risk(db, make_user):
    """Ein Update darf die Einstufung bestehender Vorlagen nicht aendern."""
    user = make_user(email="pf-tmpl@example.com")
    template = Template(name="T", subject="S", html_content="<p>x</p>", created_by_id=user.id)
    db.add(template)
    db.commit()
    db.refresh(template)
    assert template.risk_class == "low"


def test_invalid_risk_class_is_rejected_by_the_database(db, make_user):
    """Die Regel haengt nicht allein an der Anwendungslogik."""
    from sqlalchemy.exc import IntegrityError

    user = make_user(email="pf-tmpl2@example.com")
    template = Template(
        name="T", subject="S", html_content="<p>x</p>", created_by_id=user.id, risk_class="kritisch"
    )
    db.add(template)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


# --- API --------------------------------------------------------------------


def test_config_roundtrip(client, db, make_user, auth_headers):
    admin = make_user(email="pf-admin@example.com")
    res = client.put(
        "/preflight/config",
        json={
            "quiet_hours_start": "22:00:00",
            "quiet_hours_end": "06:00:00",
            "timezone": "Europe/Berlin",
            "cooldown_days": 45,
            "second_approval_role": "privacy_officer",
        },
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["cooldown_days"] == 45
    assert body["second_approval_role"] == "privacy_officer"
    assert db.query(PreflightConfig).one().timezone == "Europe/Berlin"


def test_unknown_timezone_is_rejected(client, make_user, auth_headers):
    admin = make_user(email="pf-admin2@example.com")
    res = client.put(
        "/preflight/config",
        json={"timezone": "Nicht/Existent", "cooldown_days": 30, "second_approval_role": "admin"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 422


def test_half_a_quiet_window_is_rejected(client, make_user, auth_headers):
    """Nur eine der beiden Zeiten gesetzt greift beim Pruefen nie - stiller
    Unsinn, der besser jetzt auffaellt."""
    admin = make_user(email="pf-admin3@example.com")
    res = client.put(
        "/preflight/config",
        json={
            "quiet_hours_start": "22:00:00",
            "timezone": "UTC",
            "cooldown_days": 30,
            "second_approval_role": "admin",
        },
        headers=auth_headers(admin),
    )
    assert res.status_code == 422


def test_reading_config_is_open_to_every_user(client, make_user, auth_headers):
    """Wer eine Kampagne plant, muss die geltenden Ruhezeiten kennen."""
    user = make_user(email="pf-plain@example.com", role=UserRole.USER)
    assert client.get("/preflight/config", headers=auth_headers(user)).status_code == 200


def test_changing_config_requires_admin(client, make_user, auth_headers):
    user = make_user(email="pf-plain2@example.com", role=UserRole.USER)
    res = client.put(
        "/preflight/config",
        json={"timezone": "UTC", "cooldown_days": 30, "second_approval_role": "admin"},
        headers=auth_headers(user),
    )
    assert res.status_code == 403


def test_blackout_crud(client, db, make_user, auth_headers):
    admin = make_user(email="pf-admin4@example.com")
    now = datetime.now(timezone.utc)
    res = client.post(
        "/preflight/blackouts",
        json={
            "label": "Jahresabschluss",
            "starts_at": now.isoformat(),
            "ends_at": (now + timedelta(days=3)).isoformat(),
        },
        headers=auth_headers(admin),
    )
    assert res.status_code == 201
    window_id = res.json()["id"]

    listed = client.get("/preflight/blackouts", headers=auth_headers(admin)).json()
    assert [w["label"] for w in listed] == ["Jahresabschluss"]

    deleted = client.delete(f"/preflight/blackouts/{window_id}", headers=auth_headers(admin))
    assert deleted.status_code == 204
    assert client.get("/preflight/blackouts", headers=auth_headers(admin)).json() == []


def test_blackout_end_before_start_is_rejected(client, make_user, auth_headers):
    admin = make_user(email="pf-admin5@example.com")
    now = datetime.now(timezone.utc)
    res = client.post(
        "/preflight/blackouts",
        json={
            "label": "Falschherum",
            "starts_at": now.isoformat(),
            "ends_at": (now - timedelta(hours=1)).isoformat(),
        },
        headers=auth_headers(admin),
    )
    assert res.status_code == 422


def test_risk_themes_endpoint(client, make_user, auth_headers):
    user = make_user(email="pf-themes@example.com", role=UserRole.USER)
    res = client.get("/preflight/risk-themes", headers=auth_headers(user))
    assert res.status_code == 200
    assert {c["id"] for c in res.json()["classes"]} == {"low", "medium", "high"}


def test_template_api_accepts_risk_class(client, make_user, auth_headers):
    admin = make_user(email="pf-tmpl-api@example.com")
    res = client.post(
        "/templates",
        json={"name": "Gehalt", "subject": "Gehaltsabrechnung", "html_content": "<p>x</p>", "risk_class": "high"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 201
    assert res.json()["risk_class"] == "high"


def test_template_api_rejects_unknown_risk_class(client, make_user, auth_headers):
    admin = make_user(email="pf-tmpl-api2@example.com")
    res = client.post(
        "/templates",
        json={"name": "X", "subject": "S", "html_content": "<p>x</p>", "risk_class": "kritisch"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 422


def test_exclusions_carry_no_reason_column():
    """Die Ausschlusstabelle darf **nie** einen Grund speichern.

    Eine Spalte dafuer waere schnell ergaenzt und genauso schnell mit
    Elternzeit, Krankheit oder einem laufenden Verfahren gefuellt. Dieser Test
    steht hier, damit das eine bewusste Entscheidung bleibt und keine Luecke,
    die jemand spaeter gutmeinend schliesst.
    """
    from app.models import CampaignGroupExclusion

    columns = set(CampaignGroupExclusion.__table__.columns.keys())
    assert columns == {"id", "campaign_id", "group_id", "created_at"}
    forbidden = {"reason", "grund", "note", "comment", "kommentar"}
    assert not (columns & forbidden)


def test_shipped_theme_file_is_valid_json():
    data = json.loads(preflight.THEMES_FILE.read_text(encoding="utf-8"))
    assert {c["id"] for c in data["classes"]} == {"low", "medium", "high"}
