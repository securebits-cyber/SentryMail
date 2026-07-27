# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Automatische Abmeldung nach Untaetigkeit.

Der Kern ist die gleitende Sitzung: Sie laeuft N Minuten nach der **letzten**
Anfrage ab, nicht N Minuten nach dem Login. Und sie wird ueber die
Token-Gueltigkeit erzwungen - ein Timer im Browser waere eine Bitte, keine
Grenze, und liesse sich mit den Entwicklerwerkzeugen abschalten.

Ausgeschaltet (Vorgabe 0) muss alles bleiben wie zuvor: Ein Update darf
bestehende Installationen nicht stiller aussperren.
"""
from datetime import datetime, timezone

import jwt
import pytest

from app.config import get_settings
from app.models import SecurityConfig
from app.services import session_policy
from app.utils.security import SESSION_COOKIE, create_access_token


def _exp(token: str) -> datetime:
    settings = get_settings()
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    return datetime.fromtimestamp(payload["exp"], tz=timezone.utc)


def _minutes_ahead(token: str) -> float:
    return (_exp(token) - datetime.now(timezone.utc)).total_seconds() / 60


@pytest.fixture
def config(db):
    row = db.query(SecurityConfig).first()
    if row is None:
        row = SecurityConfig()
        db.add(row)
    row.idle_logout_minutes = 0
    db.commit()
    return row


# --- Die Politik selbst -----------------------------------------------------


def test_off_by_default_keeps_the_previous_behaviour(db, config):
    """Vorgabe 0: Ein Update aendert die Sitzungsdauer bestehender
    Installationen nicht."""
    assert session_policy.idle_minutes(db) is None


def test_a_configured_value_is_reported(db, config):
    config.idle_logout_minutes = 15
    db.commit()
    assert session_policy.idle_minutes(db) == 15


# --- Token-Laufzeit ---------------------------------------------------------


def test_the_token_lifetime_follows_the_setting():
    token = create_access_token("00000000-0000-0000-0000-000000000001", expires_minutes=5)
    assert 4 < _minutes_ahead(token) <= 5


def test_without_a_setting_the_env_lifetime_applies():
    token = create_access_token("00000000-0000-0000-0000-000000000001")
    expected = get_settings().ACCESS_TOKEN_EXPIRE_MINUTES
    assert expected - 1 < _minutes_ahead(token) <= expected


# --- Gleitende Erneuerung ---------------------------------------------------


def test_a_request_renews_the_session(client, db, config, make_user, auth_headers):
    """Der eigentliche Zweck: Wer arbeitet, bleibt angemeldet."""
    config.idle_logout_minutes = 20
    db.commit()
    user = make_user(email="idle-1@example.de")

    res = client.get("/campaigns", headers=auth_headers(user), cookies={SESSION_COOKIE: "x"})
    # Das Cookie wird neu gesetzt - mit der eingestellten Laufzeit.
    cookie = res.headers.get("set-cookie", "")
    assert SESSION_COOKIE in cookie
    assert "Max-Age=1200" in cookie, cookie


def test_no_renewal_when_switched_off(client, db, config, make_user, auth_headers):
    """Ausgeschaltet darf keine Antwort das Sitzungs-Cookie anfassen - sonst
    verlaengerte sich die feste Laufzeit unbemerkt bei jeder Anfrage."""
    user = make_user(email="idle-2@example.de")
    res = client.get("/campaigns", headers=auth_headers(user), cookies={SESSION_COOKIE: "x"})
    assert SESSION_COOKIE not in res.headers.get("set-cookie", "")


def test_bearer_clients_get_no_cookie(client, db, config, make_user, auth_headers):
    """Ein API-Client schickt kein Session-Cookie und soll auch keins
    bekommen - sonst haengt einem Skript eine Browser-Sitzung an."""
    config.idle_logout_minutes = 20
    db.commit()
    user = make_user(email="idle-3@example.de")
    res = client.get("/campaigns", headers=auth_headers(user))
    assert SESSION_COOKIE not in res.headers.get("set-cookie", "")


# --- Einstellung ------------------------------------------------------------


def test_an_admin_can_set_and_read_the_value(client, make_user, auth_headers):
    admin = make_user(email="idle-admin@example.de")
    res = client.put(
        "/settings/security",
        json={"require_2fa": "off", "idle_logout_minutes": 30},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200, res.text
    assert res.json()["idle_logout_minutes"] == 30

    res = client.get("/settings/security", headers=auth_headers(admin))
    assert res.json()["idle_logout_minutes"] == 30


@pytest.mark.parametrize("value", [-1, 1441, 100000])
def test_unreasonable_values_are_refused(client, make_user, auth_headers, value):
    """Ueber 24 Stunden waere es keine automatische Abmeldung mehr, sondern
    eine Sitzung ohne Ende mit einer Zahl davor."""
    admin = make_user(email=f"idle-admin-{abs(value)}@example.de")
    res = client.put(
        "/settings/security",
        json={"require_2fa": "off", "idle_logout_minutes": value},
        headers=auth_headers(admin),
    )
    assert res.status_code == 422
