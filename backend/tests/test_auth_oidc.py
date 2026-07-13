# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer die User-Zuordnung im OIDC-Callback (Subject/E-Mail-Verknuepfung)."""
import pytest
from fastapi import HTTPException

from app.auth.oidc import _get_or_create_user
from app.models import User


def test_existing_subject_is_updated(db, make_user):
    user = make_user(email="alt@example.com", full_name="Alt")
    user.oidc_subject = "sub-1"
    db.commit()

    result = _get_or_create_user(db, "sub-1", "neu@example.com", "Neu", email_verified=True)

    assert result.id == user.id
    assert result.email == "neu@example.com"
    assert result.full_name == "Neu"


def test_existing_email_gets_linked_to_subject(db, make_user):
    """Bestehendes Konto (z. B. lokal angelegt) wird per verifizierter E-Mail mit
    SSO verknuepft statt am Unique-Index auf email zu scheitern."""
    user = make_user(email="m.dellmann@example.com")
    assert user.oidc_subject is None

    result = _get_or_create_user(
        db, "sub-neu", "m.dellmann@example.com", "M. Dellmann", email_verified=True
    )

    assert result.id == user.id
    assert result.oidc_subject == "sub-neu"
    assert db.query(User).filter(User.email == "m.dellmann@example.com").count() == 1


def test_unverified_email_is_not_linked(db, make_user):
    """Unverifizierte IdP-E-Mail darf kein bestehendes Konto uebernehmen -> 409."""
    make_user(email="opfer@example.com")

    with pytest.raises(HTTPException) as exc:
        _get_or_create_user(db, "sub-boese", "opfer@example.com", "X", email_verified=False)

    assert exc.value.status_code == 409
    assert db.query(User).filter(User.email == "opfer@example.com").first().oidc_subject is None


def test_already_federated_account_is_not_rebound(db, make_user):
    """Konto mit fremdem Subject wird nicht auf ein neues Subject umgebunden -> 409."""
    user = make_user(email="fed@example.com")
    user.oidc_subject = "sub-alt"
    db.commit()

    with pytest.raises(HTTPException) as exc:
        _get_or_create_user(db, "sub-anders", "fed@example.com", "X", email_verified=True)

    assert exc.value.status_code == 409
    db.refresh(user)
    assert user.oidc_subject == "sub-alt"


def test_unknown_subject_and_email_creates_user(db):
    result = _get_or_create_user(db, "sub-x", "frisch@example.com", "Frisch", email_verified=True)

    assert result.id is not None
    assert result.oidc_subject == "sub-x"
    assert result.email == "frisch@example.com"


def test_trust_email_setting_roundtrip(client, make_user, auth_headers):
    """trust_email laesst sich ueber die Settings-API setzen und lesen."""
    admin = make_user(email="root@example.com")
    headers = auth_headers(admin)

    resp = client.get("/settings/oidc", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["trust_email"] is False

    resp = client.put("/settings/oidc", json={"trust_email": True}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["trust_email"] is True

    resp = client.get("/settings/oidc", headers=headers)
    assert resp.json()["trust_email"] is True


def test_missing_email_keeps_existing_value(db, make_user):
    user = make_user(email="bleibt@example.com")
    user.oidc_subject = "sub-2"
    db.commit()

    result = _get_or_create_user(db, "sub-2", None, "Ohne Mail", email_verified=False)

    assert result.id == user.id
    assert result.email == "bleibt@example.com"
