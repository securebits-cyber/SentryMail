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


def _bilingual(value, where: str) -> dict:
    """Prueft ein ``{"de": …, "en": …}``-Feld."""
    if not isinstance(value, dict):
        raise ProfileError(f"{where}: muss ein Objekt mit de und en sein")
    for lang in ("de", "en"):
        if not isinstance(value.get(lang), str) or not value[lang].strip():
            raise ProfileError(f"{where}: '{lang}' fehlt oder ist kein Text")
    return value


def _check_snippet(snippet, where: str) -> None:
    if not isinstance(snippet, dict):
        raise ProfileError(f"{where}: Snippet ist kein Objekt")
    if not isinstance(snippet.get("id"), str) or not snippet["id"].strip():
        raise ProfileError(f"{where}: Snippet ohne id")
    _bilingual(snippet.get("title"), f"{where}.title")

    kind = snippet.get("kind", "code")
    if kind not in ("code", "steps"):
        raise ProfileError(f"{where}: unbekannte Art '{kind}'")
    if kind == "code":
        if not isinstance(snippet.get("code"), str) or not snippet["code"].strip():
            raise ProfileError(f"{where}: code fehlt oder ist kein Text")
        if not isinstance(snippet.get("language", "text"), str):
            raise ProfileError(f"{where}: language ist kein Text")
    else:
        steps = snippet.get("steps")
        if not isinstance(steps, dict):
            raise ProfileError(f"{where}: steps fehlt")
        for lang in ("de", "en"):
            entries = steps.get(lang)
            if not isinstance(entries, list) or not entries:
                raise ProfileError(f"{where}.steps.{lang}: keine Schritte")
            if not all(isinstance(step, str) for step in entries):
                raise ProfileError(f"{where}.steps.{lang}: Schritte muessen Text sein")

    if snippet.get("note") is not None:
        _bilingual(snippet["note"], f"{where}.note")


def _load_one(path: Path) -> dict:
    """Laedt und **validiert** ein Profil vollstaendig.

    Streng, weil ein Profil eine Datendatei ist, an der jemand ohne
    Codekenntnis arbeitet. Wuerde hier ein falscher Typ durchrutschen, faellt er
    erst beim Sortieren oder Rendern auf - und dann als ``TypeError``, der den
    ganzen Assistenten mitreisst statt nur diese eine Datei.
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ProfileError(f"{path.name}: kein JSON-Objekt")
    if data.get("id") != path.stem:
        raise ProfileError(f"{path.name}: id '{data.get('id')}' passt nicht zum Dateinamen")

    order = data.get("order", 1000)
    # bool ist in Python ein int - hier waere es fast sicher ein Versehen.
    if not isinstance(order, int) or isinstance(order, bool):
        raise ProfileError(f"{path.name}: order muss eine ganze Zahl sein")
    data["order"] = order

    _bilingual(data.get("label"), f"{path.name}.label")

    inputs = data.get("inputs", [])
    if not isinstance(inputs, list) or not all(isinstance(i, str) for i in inputs):
        raise ProfileError(f"{path.name}: inputs muss eine Liste von Texten sein")
    unknown = set(inputs) - set(KNOWN_INPUTS)
    if unknown:
        raise ProfileError(f"{path.name}: unbekannte Eingaben {sorted(unknown)}")
    data["inputs"] = inputs

    docs = data.get("vendor_docs")
    if docs is not None and not isinstance(docs, str):
        raise ProfileError(f"{path.name}: vendor_docs ist kein Text")

    snippets = data.get("snippets")
    if not isinstance(snippets, list) or not snippets:
        raise ProfileError(f"{path.name}: keine Snippets")
    for i, snippet in enumerate(snippets):
        _check_snippet(snippet, f"{path.name}.snippets[{i}]")
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
        except Exception as exc:  # noqa: BLE001 - eine kaputte Datei darf nie den Rest kippen
            # Bewusst breit: Die Validierung soll jeden Fehler in einer
            # Datendatei auf genau diese Datei begrenzen. Eine engere Klausel
            # hat hier schon einmal einen TypeError durchgelassen, der alle
            # Profile mitgerissen hat.
            logger.error("Gateway-Profil %s uebersprungen: %s", path.name, exc)
    # order ist durch _load_one garantiert ein int - sonst waere die Datei
    # gar nicht erst in der Liste.
    profiles.sort(key=lambda p: (p["order"], p["id"]))
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
