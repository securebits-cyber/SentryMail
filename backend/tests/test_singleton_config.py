# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Tests fuer die Singleton-Config-Zeilen (eine Zeile pro Tabelle, race-sicher)."""
import pytest
from sqlalchemy.exc import IntegrityError

from app.api.settings import get_or_create_oidc_config, get_or_create_security_config
from app.models import OidcConfig, SecurityConfig
from app.services.license import get_or_create_license_state
from app.services.smtp_config import get_or_create_smtp_config
from app.utils.singleton import get_or_create_singleton


def test_get_or_create_returns_same_row(db):
    first = get_or_create_singleton(db, OidcConfig)
    second = get_or_create_singleton(db, OidcConfig)
    assert first.id == second.id
    assert db.query(OidcConfig).count() == 1


def test_unique_index_blocks_second_row(db):
    """Der Ein-Zeilen-Unique-Index laesst kein Duplikat mehr zu."""
    db.add(SecurityConfig())
    db.commit()
    db.add(SecurityConfig())
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert db.query(SecurityConfig).count() == 1


def test_race_loser_reads_winner_row(db):
    """Verliert der Aufrufer das Insert-Race, liefert der Helper die Gewinner-Zeile."""
    winner = OidcConfig()
    db.add(winner)
    db.commit()

    # Simuliert den Verlierer: sieht (veraltet) keine Zeile und legt an -> der
    # Helper faengt den IntegrityError und liest die vorhandene Zeile.
    class _StaleQuery:
        def __init__(self, real, misses: int):
            self._real = real
            self._misses = misses

        def first(self):
            if self._misses > 0:
                self._misses -= 1
                return None
            return self._real.first()

    class _StaleSession:
        def __init__(self, real):
            self._real = real
            self._miss = 1

        def query(self, model):
            q = self._real.query(model)
            if self._miss:
                self._miss -= 1
                return _StaleQuery(q, 1)
            return q

        def __getattr__(self, name):
            return getattr(self._real, name)

    result = get_or_create_singleton(_StaleSession(db), OidcConfig)
    assert result.id == winner.id
    assert db.query(OidcConfig).count() == 1


def test_all_accessors_create_exactly_one_row(db):
    get_or_create_oidc_config(db)
    get_or_create_oidc_config(db)
    get_or_create_security_config(db)
    get_or_create_security_config(db)
    get_or_create_smtp_config(db)
    get_or_create_smtp_config(db)
    get_or_create_license_state(db)
    get_or_create_license_state(db)

    from app.models import LicenseState, SmtpConfig

    for model in (OidcConfig, SecurityConfig, SmtpConfig, LicenseState):
        assert db.query(model).count() == 1
