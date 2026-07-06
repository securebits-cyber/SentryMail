# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Feature-Gating: LDAP ist ein Business-Feature und ohne gueltige Business-
Lizenz gesperrt (HTTP 403). Ohne Lizenz ist der Default-Zustand `no_license`,
also kein aktives Feature."""
from app.models import UserRole


def test_ldap_config_gated_without_business_license(client, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    resp = client.get("/settings/ldap", headers=auth_headers(admin))
    assert resp.status_code == 403


def test_ldap_test_gated_without_business_license(client, make_user, auth_headers):
    admin = make_user(role=UserRole.ADMIN)
    resp = client.post("/settings/ldap/test", headers=auth_headers(admin))
    assert resp.status_code == 403


def test_oidc_config_not_gated(client, make_user, auth_headers):
    """Gegenprobe: OIDC ist Open Core und bleibt ohne Lizenz erreichbar."""
    admin = make_user(role=UserRole.ADMIN)
    resp = client.get("/settings/oidc", headers=auth_headers(admin))
    assert resp.status_code == 200
