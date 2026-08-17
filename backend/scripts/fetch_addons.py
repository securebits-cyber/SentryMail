# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Lizenzierte Add-on-Pakete beim Containerstart holen und installieren.

Wird vom Entrypoint aufgerufen, **bevor** uvicorn startet – die Add-ons
registrieren sich über Entry Points, und die liest Python nur beim Start des
Prozesses. Ein nachträglich installiertes Paket wäre bis zum nächsten Neustart
unsichtbar.

**Der Bezug läuft über den Lizenzserver, nicht über GitHub.** Die Installation
legt ihren Lizenzschlüssel vor, der Server prüft die Berechtigung und reicht
das Paket durch. Es gibt hier kein GitHub-Token und keine Kenntnis darüber,
wo die Pakete liegen – das ist Sache des Anbieters und über
``LICENSE_SERVER_URL`` austauschbar.

**Drei Eigenschaften sind nicht verhandelbar:**

1. *Ein Fehlschlag darf den Start nie verhindern.* Kein Netz, abgelaufene
   Lizenz, Ausfall des Lizenzservers – die Installation startet als Open Core
   weiter. Alles andere hieße, dass ein Ausfall beim Anbieter die Anwendung des
   Kunden stilllegt.
2. *Idempotent.* Ohne diese Prüfung zöge jeder Containerstart die vollständigen
   Pakete erneut über die Leitung.
3. *Der Kunde konfiguriert nur seinen Lizenzschlüssel.* Welche Pakete er
   bekommt, entscheidet der Server aus dem Tier – keine Paketliste in der
   ``.env``, die mit dem Gekauften auseinanderlaufen könnte.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from importlib import metadata
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s addons: %(message)s")
logger = logging.getLogger("fetch_addons")

# Angefragt wird jedes bekannte Paket. Der Lizenzserver antwortet mit 404,
# wenn die Lizenz es nicht trägt oder es der Anbieter nicht ausliefert – beides
# ist hier derselbe Fall: überspringen, nicht scheitern.
#
# Produkt -> Name der Python-Distribution, unter dem pip das Paket führt.
# Bewusst NUR die beiden Wheels: Das Awareness-Inhaltsbündel ist ein Archiv,
# kein Wheel – ``pip install`` würde daran scheitern. Sobald das Bündelformat
# steht (Manifest-Schema v1), bekommt es einen eigenen Zweig, der entpackt
# statt installiert. Vorher hier nichts zu raten.
PRODUCTS = {
    "business": "humanshield-addon-business",
    "enterprise": "humanshield-addon-enterprise",
}

# Merkzettel je Paket: der zuletzt installierte Dateiname, im Volume.
STATE_DIR = Path(os.environ.get("ADDON_STATE_DIR", "/app/data/addons"))

TIMEOUT_INFO = 15
TIMEOUT_DOWNLOAD = 900


def _post(url: str, payload: dict, timeout: int):
    """POST mit JSON-Body. Gibt die geöffnete Antwort zurück."""
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "*/*"},
        method="POST",
    )
    return urllib.request.urlopen(request, timeout=timeout)  # noqa: S310 - feste URL aus der Config


def fetch_info(base_url: str, license_key: str, product: str) -> dict | None:
    """Dateiname und Größe erfragen, ohne das Paket zu übertragen.

    ``None`` heißt „nicht beziehen" – sei es, weil die Lizenz das Paket nicht
    trägt (404), sei es, weil der Server ihn nicht ausliefert. Die
    Unterscheidung ist bewusst nicht möglich und hier auch nicht nötig.
    """
    try:
        with _post(
            f"{base_url}/v1/artifact/info",
            {"license_key": license_key, "product": product},
            TIMEOUT_INFO,
        ) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            logger.info("%s: nicht lizenziert oder nicht verfuegbar", product)
        elif exc.code in (401, 410):
            # Betrifft alle Pakete gleichermassen – der Aufrufer bricht ab.
            logger.warning("Lizenzschluessel abgelehnt (HTTP %s)", exc.code)
            raise
        else:
            logger.warning("%s: Lizenzserver antwortet HTTP %s", product, exc.code)
        return None
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
        logger.warning("%s: Lizenzserver nicht erreichbar (%s)", product, exc)
        return None


def already_installed(product: str, distribution: str, filename: str) -> bool:
    """Ist genau diese Datei installiert – und ist sie es *jetzt noch*?

    Zwei Prüfungen, weil eine nicht genügt: Der Merkzettel liegt im Volume und
    überlebt, ``site-packages`` liegt in der Container-Schicht und überlebt
    nicht. Nach einem ``docker compose build`` wäre das Paket weg, der
    Merkzettel aber noch da – das Add-on fehlte dann stillschweigend, und im
    Dashboard stünde ein bezahltes Feature als nicht installiert.
    """
    marker = STATE_DIR / f"{product}.installed"
    try:
        if marker.read_text(encoding="utf-8").strip() != filename:
            return False
    except OSError:
        return False

    try:
        metadata.version(distribution)
    except metadata.PackageNotFoundError:
        logger.info("%s: Merkzettel vorhanden, Paket aber nicht installiert – laden", product)
        return False
    return True


def remember(product: str, filename: str) -> None:
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        (STATE_DIR / f"{product}.installed").write_text(filename, encoding="utf-8")
    except OSError as exc:
        # Nicht schlimm: Ohne Merkzettel wird beim nächsten Start erneut
        # geladen. Das kostet Bandbreite, nicht Korrektheit.
        logger.warning("%s: Merkzettel nicht schreibbar (%s)", product, exc)


def install(base_url: str, license_key: str, product: str, filename: str) -> bool:
    """Paket laden und mit pip installieren."""
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / filename
        try:
            with _post(
                f"{base_url}/v1/artifact",
                {"license_key": license_key, "product": product},
                TIMEOUT_DOWNLOAD,
            ) as response, open(target, "wb") as handle:
                while chunk := response.read(1024 * 256):
                    handle.write(chunk)
        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as exc:
            logger.warning("%s: Download fehlgeschlagen (%s)", product, exc)
            return False

        result = subprocess.run(  # noqa: S603 - festes Argv, kein Shell-Aufruf
            [sys.executable, "-m", "pip", "install", "--no-cache-dir", str(target)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            # Die letzten Zeilen genügen; die vollständige pip-Ausgabe ist lang
            # und der Fehler steht immer am Ende.
            logger.error(
                "%s: Installation fehlgeschlagen\n%s",
                product,
                "\n".join(result.stderr.strip().splitlines()[-15:]),
            )
            return False

    logger.info("%s: %s installiert", product, filename)
    return True


def main() -> int:
    base_url = os.environ.get("LICENSE_SERVER_URL", "").strip().rstrip("/")
    license_key = os.environ.get("LICENSE_KEY", "").strip()

    if not base_url or not license_key:
        # Der Regelfall bei Open-Core-Installationen. Kein Fehler, keine
        # Warnung – nur ein Hinweis, damit im Zweifel nachvollziehbar ist,
        # warum kein Add-on geladen wurde.
        logger.info(
            "LICENSE_SERVER_URL oder LICENSE_KEY nicht gesetzt – Start als Open Core"
        )
        return 0

    for product, distribution in PRODUCTS.items():
        try:
            info = fetch_info(base_url, license_key, product)
        except urllib.error.HTTPError:
            # Schluessel ungueltig oder Lizenz abgelaufen: Bei den uebrigen
            # Paketen waere die Antwort dieselbe.
            logger.warning("Kein Paketbezug moeglich – Start als Open Core")
            return 0

        if not info:
            continue

        filename = str(info.get("filename") or "")
        if not filename:
            logger.warning("%s: Antwort ohne Dateinamen", product)
            continue

        if already_installed(product, distribution, filename):
            logger.info("%s: %s bereits installiert", product, filename)
            continue

        if install(base_url, license_key, product, filename):
            remember(product, filename)

    return 0


if __name__ == "__main__":
    # Immer 0: Der Entrypoint startet die Anwendung anschliessend in jedem Fall.
    try:
        sys.exit(main())
    except Exception:  # noqa: BLE001 - ein Fehler hier darf den Start nie verhindern
        logger.exception("Unerwarteter Fehler beim Paketbezug – Start als Open Core")
        sys.exit(0)
