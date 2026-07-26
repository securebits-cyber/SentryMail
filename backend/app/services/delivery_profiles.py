# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Allowlisting-Generator fuer Mail-Gateways (Welle 9.1, Core).

Der groesste Supportkostentreiber in den ersten zwei Wochen beim Kunden ist
nicht die Software, sondern das Gateway davor: Die Simulation kommt nicht an,
oder der Linkscanner klickt sie selbst an. Dieses Modul erzeugt aus pflegbaren
Datendateien (``app/data/gateway_profiles/*.json``) fertige Konfigurations-
schnipsel bzw. Schrittfolgen fuer das jeweilige Gateway.

**Kein Anbieter ist im Code verdrahtet.** Ein neues Gateway ist eine neue
JSON-Datei, kein Codeeingriff - so verlangt es die Roadmap, und so bleibt der
Stack vendor-neutral. Format und Platzhalter beschreibt die README im
Profilverzeichnis.

JSON statt YAML, weil der Core dafuer sonst eine Abhaengigkeit braeuchte; die
Profile sind strukturierte Daten, kein Fliesstext.
"""
from __future__ import annotations

import json
import logging
import re
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

PROFILE_DIR = Path(__file__).resolve().parent.parent / "data" / "gateway_profiles"

#: Eingaben, die ein Profil anfordern darf. Geschlossene Liste: Ein Profil soll
#: keine beliebigen Felder erfinden koennen, sonst steht die Oberflaeche vor
#: einem Eingabefeld, dessen Bedeutung niemand kennt.
KNOWN_INPUTS = ("sender_domain", "sender_ips", "tracking_domain")

_PLACEHOLDER = re.compile(r"\{\{(\w+)\}\}")

#: Obergrenze je Eingabewert. Die Werte landen in einem Snippet, das jemand in
#: eine Konsole kopiert - da hat ein Roman nichts zu suchen.
MAX_INPUT_LENGTH = 200


class ProfileError(Exception):
    """Profil ist unbrauchbar oder unbekannt."""


def _load_one(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ProfileError(f"{path.name}: kein JSON-Objekt")
    if data.get("id") != path.stem:
        raise ProfileError(f"{path.name}: id '{data.get('id')}' passt nicht zum Dateinamen")
    unknown = set(data.get("inputs", [])) - set(KNOWN_INPUTS)
    if unknown:
        raise ProfileError(f"{path.name}: unbekannte Eingaben {sorted(unknown)}")
    if not data.get("snippets"):
        raise ProfileError(f"{path.name}: keine Snippets")
    return data


@lru_cache(maxsize=1)
def load_profiles() -> list[dict]:
    """Alle Profile, nach ``order`` sortiert.

    Eine fehlerhafte Datei laesst die uebrigen Profile stehen: Ein Tippfehler in
    einem Profil darf nicht den ganzen Assistenten ausschalten.
    """
    profiles: list[dict] = []
    if not PROFILE_DIR.is_dir():
        logger.warning("Gateway-Profilverzeichnis fehlt: %s", PROFILE_DIR)
        return profiles
    for path in sorted(PROFILE_DIR.glob("*.json")):
        try:
            profiles.append(_load_one(path))
        except (ProfileError, ValueError, OSError) as exc:
            logger.error("Gateway-Profil %s uebersprungen: %s", path.name, exc)
    profiles.sort(key=lambda p: (p.get("order", 1000), p["id"]))
    return profiles


def get_profile(gateway_id: str) -> dict:
    for profile in load_profiles():
        if profile["id"] == gateway_id:
            return profile
    raise ProfileError(f"Unbekanntes Gateway: {gateway_id}")


def _substitute(text: str, values: dict[str, str]) -> str:
    """Ersetzt ``{{name}}``. Unbelegte Platzhalter bleiben sichtbar stehen.

    Absichtlich nicht durch Leerstring ersetzen: Eine Konfigurationszeile mit
    einem stillen Loch wird kopiert und faellt erst beim Kunden auf.
    """

    def repl(match: re.Match[str]) -> str:
        value = values.get(match.group(1))
        return value if value else match.group(0)

    return _PLACEHOLDER.sub(repl, text)


def _clean_inputs(raw: dict[str, str] | None) -> dict[str, str]:
    values: dict[str, str] = {}
    for key in KNOWN_INPUTS:
        value = (raw or {}).get(key)
        if value is None:
            continue
        # Zeilenumbrueche raus: Der Wert wird in eine Konfigurationszeile
        # eingesetzt; ein Umbruch darin erzeugt stillschweigend eine zweite,
        # unbeabsichtigte Direktive.
        cleaned = " ".join(str(value).split())[:MAX_INPUT_LENGTH]
        if cleaned:
            values[key] = cleaned
    return values


def render(gateway_id: str, raw_inputs: dict[str, str] | None) -> dict:
    """Rendert die Snippets eines Gateways mit den uebergebenen Werten.

    Sprachneutral: Titel, Hinweise und Schritte kommen als ``{"de": …, "en": …}``
    zurueck, die Auswahl trifft das Frontend. Sonst muesste die API die
    Oberflaechensprache kennen.
    """
    profile = get_profile(gateway_id)
    values = _clean_inputs(raw_inputs)
    missing = [key for key in profile.get("inputs", []) if key not in values]

    rendered = []
    for snippet in profile["snippets"]:
        item = {
            "id": snippet["id"],
            "title": snippet["title"],
            "kind": snippet.get("kind", "code"),
            "note": snippet.get("note"),
        }
        if item["kind"] == "code":
            item["language"] = snippet.get("language", "text")
            item["code"] = _substitute(snippet.get("code", ""), values)
        else:
            item["steps"] = {
                lang: [_substitute(step, values) for step in steps]
                for lang, steps in (snippet.get("steps") or {}).items()
            }
        rendered.append(item)

    return {
        "gateway": profile["id"],
        "label": profile["label"],
        "vendor_docs": profile.get("vendor_docs"),
        "missing_inputs": missing,
        "snippets": rendered,
    }


def reset_cache() -> None:
    """Profil-Cache leeren (Tests / geaenderte Datendateien)."""
    load_profiles.cache_clear()
