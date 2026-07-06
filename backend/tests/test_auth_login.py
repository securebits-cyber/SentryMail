# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Integrationstests fuer den lokalen Login (primaere Anmeldemethode)."""
from app.models import SecurityConfig, UserRole

PASSWORD = "correct horse battery staple"


def test_login_success_returns_token(client, make_user):
    make_user(email="admin@example.com", password=PASSWORD)
    resp = client.post("/auth/local/login", json={"email": "admin@example.com", "password": PASSWORD})
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["twofa_required"] is False


def test_login_wrong_password(client, make_user):
    make_user(email="admin@example.com", password=PASSWORD)
    resp = client.post("/auth/local/login", json={"email": "admin@example.com", "password": "falsch"})
    assert resp.status_code == 401
    assert "access_token" not in resp.json()


def test_login_unknown_email(client):
    resp = client.post("/auth/local/login", json={"email": "nobody@example.com", "password": PASSWORD})
    assert resp.status_code == 401


def test_login_inactive_user_forbidden(client, make_user):
    make_user(email="off@example.com", password=PASSWORD, is_active=False)
    resp = client.post("/auth/local/login", json={"email": "off@example.com", "password": PASSWORD})
    assert resp.status_code == 403


def test_login_forced_2fa_requires_setup(client, db, make_user):
    """Policy 'all' erzwingt 2FA-Einrichtung: Login liefert setup_required."""
    db.add(SecurityConfig(require_2fa="all"))
    db.commit()
    make_user(email="admin@example.com", password=PASSWORD, role=UserRole.ADMIN)

    resp = client.post("/auth/local/login", json={"email": "admin@example.com", "password": PASSWORD})
    assert resp.status_code == 200
    body = resp.json()
    assert body["twofa_required"] is True
    assert body["setup_required"] is True
    assert body["access_token"] is None
    assert body["pre_auth_token"]


def test_protected_route_requires_token(client):
    """Ohne Token kein Zugriff auf geschuetzte Endpunkte."""
    resp = client.get("/users/")
    assert resp.status_code == 401


def test_pre_auth_token_cannot_access_api(client, make_user, db):
    """2FA-Pre-Auth-Token (scope=2fa) darf keine regulaeren Endpunkte oeffnen."""
    from app.auth.permissions import TWOFA_SCOPE
    from app.utils.security import create_access_token

    user = make_user(email="admin@example.com", password=PASSWORD)
    pre_auth = create_access_token(subject=str(user.id), extra_claims={"scope": TWOFA_SCOPE})
    resp = client.get("/users/", headers={"Authorization": f"Bearer {pre_auth}"})
    assert resp.status_code == 401
