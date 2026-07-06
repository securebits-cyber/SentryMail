# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Optionaler GeoIP-Lookup (Laendercode) auf Basis einer lokalen MMDB-Datei.

Vendor-neutral: Der Betreiber hinterlegt ueber ``GEOIP_DB_PATH`` (.env) eine
beliebige Country-Datenbank im MMDB-Format (MaxMind GeoLite2-Country, DB-IP
Lite, IPinfo Country, ...). Ohne konfigurierte Datei bleibt der Lookup einfach
aus (Rueckgabe None) - es wird nie ein externer Dienst aufgerufen.
"""
import ipaddress
import logging
import threading

from app.config import get_settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_reader = None
_reader_failed = False


def _get_reader():
    """Oeffnet die MMDB-Datei einmalig (lazy); None wenn nicht konfiguriert/lesbar."""
    global _reader, _reader_failed
    if _reader is not None or _reader_failed:
        return _reader
    db_path = get_settings().GEOIP_DB_PATH
    if not db_path:
        return None
    with _lock:
        if _reader is not None or _reader_failed:
            return _reader
        try:
            import maxminddb

            _reader = maxminddb.open_database(db_path)
            logger.info("GeoIP-Datenbank geladen: %s", db_path)
        except Exception:  # noqa: BLE001 - GeoIP ist optional, darf den Start nie brechen
            _reader_failed = True
            logger.warning("GeoIP-Datenbank nicht ladbar (%s) - Laender-Lookup deaktiviert", db_path)
    return _reader


def lookup_country(ip: str | None) -> str | None:
    """ISO-3166-Laendercode (z. B. "DE") zur IP oder None.

    Private/loopback-Adressen und alles ohne Treffer ergeben None.
    """
    if not ip:
        return None
    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return None
    if parsed.is_private or parsed.is_loopback or parsed.is_link_local:
        return None
    reader = _get_reader()
    if reader is None:
        return None
    try:
        record = reader.get(ip) or {}
        code = (record.get("country") or {}).get("iso_code")
        return code if isinstance(code, str) and len(code) == 2 else None
    except Exception:  # noqa: BLE001 - Lookup-Fehler duerfen das Tracking nie brechen
        return None
