# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Leichtgewichtiges, abhaengigkeitsfreies Parsen des User-Agent-Strings.

Liefert grobe Buckets fuer Browser, Betriebssystem und Geraetetyp - ausreichend
fuer Awareness-Auswertungen (Browserstatistik, Geraeteverteilung), ohne eine
externe UA-Parsing-Bibliothek in den Core zu ziehen. Reihenfolge der Regeln
ist bewusst: spezifischere Marker (Edge, Opera) vor generischen (Chrome, Safari).
"""
from __future__ import annotations

# (Marker im UA-String, Anzeigename) - erste Uebereinstimmung gewinnt.
_BROWSERS: list[tuple[str, str]] = [
    ("Edg/", "Edge"),
    ("EdgA/", "Edge"),
    ("OPR/", "Opera"),
    ("Opera", "Opera"),
    ("SamsungBrowser", "Samsung Internet"),
    ("Vivaldi", "Vivaldi"),
    ("Brave", "Brave"),
    ("Firefox", "Firefox"),
    ("FxiOS", "Firefox"),
    ("CriOS", "Chrome"),
    ("Chrome", "Chrome"),
    ("Chromium", "Chromium"),
    ("Safari", "Safari"),
    ("MSIE", "Internet Explorer"),
    ("Trident", "Internet Explorer"),
]

_OS: list[tuple[str, str]] = [
    ("Windows NT 10.0", "Windows 10/11"),
    ("Windows NT 6.3", "Windows 8.1"),
    ("Windows NT 6.2", "Windows 8"),
    ("Windows NT 6.1", "Windows 7"),
    ("Windows", "Windows"),
    ("iPhone", "iOS"),
    ("iPad", "iPadOS"),
    ("Android", "Android"),
    ("Mac OS X", "macOS"),
    ("Macintosh", "macOS"),
    ("CrOS", "ChromeOS"),
    ("Linux", "Linux"),
]

_MOBILE_MARKERS = ("Mobi", "iPhone", "Android", "Windows Phone", "IEMobile")
_TABLET_MARKERS = ("iPad", "Tablet")


def parse_user_agent(ua: str | None) -> tuple[str | None, str | None, str | None]:
    """Zerlegt einen User-Agent in (browser, os, device_type).

    device_type ist "mobile", "tablet", "bot" oder "desktop". Fehlt der
    User-Agent, sind alle drei Rueckgaben ``None``.
    """
    if not ua:
        return None, None, None

    lowered = ua.lower()
    if any(m in lowered for m in ("bot", "crawler", "spider", "curl", "wget", "python-requests")):
        return None, None, "bot"

    browser = next((name for marker, name in _BROWSERS if marker in ua), None)
    os_name = next((name for marker, name in _OS if marker in ua), None)

    if any(m in ua for m in _TABLET_MARKERS):
        device = "tablet"
    elif any(m in ua for m in _MOBILE_MARKERS):
        device = "mobile"
    else:
        device = "desktop"

    return browser, os_name, device
