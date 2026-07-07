# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Update-Check (vendor-neutral, optional).

Prueft gegen eine konfigurierbare URL (Default: GitHub-Releases-API des
Projekts), ob ein neueres Release als die laufende Version verfuegbar ist.
Das Ergebnis wird in-memory zwischengespeichert (TTL), damit nicht jeder
Seitenaufruf einen externen Request ausloest. Faellt der Check aus (URL leer,
Netzwerkfehler, Rate-Limit), gilt schlicht "kein Update verfuegbar" - der
Betrieb wird dadurch nie blockiert.

Deaktivieren: ``UPDATE_CHECK_URL`` in der .env leeren.
"""
from __future__ import annotations

import logging
import re
import time

import httpx

from app.config import get_settings
from app.version import APP_VERSION

logger = logging.getLogger(__name__)

# einfacher Prozess-Cache: (abgelaufen_ab, neueste_version_oder_None)
_cache: tuple[float, str | None] | None = None

_VERSION_RE = re.compile(r"(\d+)\.(\d+)\.(\d+)")


def _parse(version: str | None) -> tuple[int, int, int] | None:
    """Extrahiert (major, minor, patch) aus z. B. 'v0.4.0' oder '0.4.0'."""
    if not version:
        return None
    m = _VERSION_RE.search(version)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def _fetch_latest(url: str, timeout: float) -> str | None:
    """Holt das neueste Release-Tag von der Update-URL (GitHub-Releases-API-Format)."""
    try:
        resp = httpx.get(url, timeout=timeout, headers={"Accept": "application/json"}, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.info("Update-Check nicht erreichbar: %s", exc)
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    # GitHub-Releases-API: {"tag_name": "v0.4.0", ...}. Fallback: {"version": "..."}.
    tag = data.get("tag_name") or data.get("name") or data.get("version") if isinstance(data, dict) else None
    return tag


def _latest_version() -> str | None:
    """Neueste verfuegbare Version (gecacht). None, wenn nicht ermittelbar/deaktiviert."""
    global _cache
    settings = get_settings()
    url = (settings.UPDATE_CHECK_URL or "").strip()
    if not url:
        return None

    now = time.monotonic()
    if _cache is not None and now < _cache[0]:
        return _cache[1]

    latest = _fetch_latest(url, timeout=float(settings.UPDATE_CHECK_TIMEOUT))
    ttl = max(1, settings.UPDATE_CHECK_INTERVAL_HOURS) * 3600
    _cache = (now + ttl, latest)
    return latest


def get_update_status() -> dict:
    """Status fuer /version: laufende Version, neueste Version, Update-Flag, Changelog-Link."""
    settings = get_settings()
    latest_raw = _latest_version()
    current = _parse(APP_VERSION)
    latest = _parse(latest_raw)
    update_available = bool(current and latest and latest > current)
    return {
        "current": APP_VERSION,
        # Normalisiert auf die Ziffernform (wie current), damit die Anzeige nicht
        # bei Tags wie "v0.4.0" ein doppeltes "v" bekommt.
        "latest": ".".join(map(str, latest)) if update_available and latest else None,
        "update_available": update_available,
        "changelog_url": settings.UPDATE_CHANGELOG_URL or None,
    }


def reset_cache() -> None:
    """Cache leeren (Tests / erzwungener Neucheck)."""
    global _cache
    _cache = None
