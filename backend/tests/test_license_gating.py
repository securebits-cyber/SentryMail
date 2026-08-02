# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Feature-Gating im Core.

Die eigentlichen Business-Funktionen (z. B. LDAP) liegen im privaten Business-
Add-on. Der Core stellt nur die Gate-Mechanik bereit: ``require_feature`` blockt
ohne gueltige Lizenz (Default-Zustand ``no_license`` -> kein aktives Feature)."""
import pytest
from fastapi import HTTPException

from app import addon_loader
from app.models import UserRole
from app.services.license import features_map, require_feature


def test_require_feature_blocks_without_license(db, make_user):
    user = make_user(role=UserRole.ADMIN)
    dependency = require_feature("business")
    with pytest.raises(HTTPException) as exc:
        dependency(db=db, _=user)
    assert exc.value.status_code == 403


def test_oidc_config_not_gated(client, make_user, auth_headers):
    """Gegenprobe: OIDC ist Open Core und bleibt ohne Lizenz erreichbar."""
    admin = make_user(role=UserRole.ADMIN)
    resp = client.get("/settings/oidc", headers=auth_headers(admin))
    assert resp.status_code == 200


def test_features_map_reports_missing_package(db):
    """Ohne installiertes Paket meldet /features `installed = false`.

    Lizenz und Paket sind unabhaengig voneinander: Das Frontend muss "nicht
    lizenziert" von "lizenziert, aber Paket fehlt" trennen koennen, sonst haengt
    eine lizenzierte Add-on-Seite ohne Paket dauerhaft im Ladezustand.
    """
    assert features_map(db)["installed"] == {"business": False, "enterprise": False}


def test_features_map_reports_loaded_package(db, monkeypatch):
    """Ein registriertes Add-on taucht in `installed` auf."""
    monkeypatch.setattr(addon_loader, "LOADED_ADDONS", {"business"})
    installed = features_map(db)["installed"]
    assert installed["business"] is True
    assert installed["enterprise"] is False
