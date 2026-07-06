# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

from app.utils import geoip
from app.utils.geoip import lookup_country


def test_lookup_without_configured_db_returns_none():
    # Ohne GEOIP_DB_PATH bleibt der Lookup aus - niemals ein Fehler.
    assert lookup_country("8.8.8.8") is None


def test_private_loopback_and_invalid_ips_return_none():
    assert lookup_country("192.168.1.10") is None
    assert lookup_country("127.0.0.1") is None
    assert lookup_country("fe80::1") is None
    assert lookup_country("not-an-ip") is None
    assert lookup_country(None) is None
    assert lookup_country("") is None


def test_lookup_uses_reader_iso_code(monkeypatch):
    class FakeReader:
        def get(self, ip):
            assert ip == "8.8.8.8"
            return {"country": {"iso_code": "DE"}}

    monkeypatch.setattr(geoip, "_get_reader", lambda: FakeReader())
    assert lookup_country("8.8.8.8") == "DE"


def test_lookup_tolerates_reader_errors(monkeypatch):
    class BrokenReader:
        def get(self, ip):
            raise RuntimeError("kaputt")

    monkeypatch.setattr(geoip, "_get_reader", lambda: BrokenReader())
    assert lookup_country("8.8.8.8") is None
