# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Signierte Offline-Update-Bundles (Welle 8, air-gapped Installationen).

Eine Installation ohne Internetzugang kann nicht per ``git pull`` aktualisiert
werden. Stattdessen wird ein Bundle uebergeben - ein Tar-Archiv aus Manifest,
Signatur und Nutzlast - das **vor** dem Entpacken vollstaendig geprueft wird:

1. Ed25519-Signatur ueber die rohen Manifest-Bytes,
2. SHA-256 je Nutzlastdatei gegen das Manifest,
3. keine Datei im Archiv, die das Manifest nicht kennt,
4. Versionskette: ``min_version`` <= laufende Version < ``target_version``.

Scheitert eine der Pruefungen, wird **nichts** entpackt. Dieses Modul prueft
ausschliesslich - es schreibt nie in den Bestand. Das Einspielen macht
``update.sh --bundle``, das Erzeugen ``tools/build_update_bundle.py``.

Format: ``.tar.gz`` (nicht zstd). Ein Offline-Bundle landet auf Maschinen, deren
Werkzeugstand wir nicht kennen; gzip ist in jeder Python- und jeder tar-Version
vorhanden, zstd nicht. Portabilitaet schlaegt hier Kompressionsrate.

Direkt aufrufbar fuer die Pruefung ausserhalb der App::

    python -m app.services.update_bundle /pfad/bundle.tar.gz
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import json
import logging
import re
import tarfile
from dataclasses import dataclass, field

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from app.version import APP_VERSION

logger = logging.getLogger(__name__)

#: Formatversion des Manifests. Wird erhoeht, sobald sich die Struktur aendert;
#: ein Bundle mit unbekannter Version wird abgelehnt statt geraten.
BUNDLE_FORMAT = 1

MANIFEST_NAME = "manifest.json"
SIGNATURE_NAME = "manifest.sig"
PAYLOAD_PREFIX = "payload/"

#: Obergrenzen gegen manipulierte Archive (Tar-Bombe, aufgeblaehtes Manifest).
#: Ein reales Bundle liegt bei wenigen MB und einigen tausend Dateien.
MAX_MANIFEST_BYTES = 8 * 1024 * 1024
MAX_SIGNATURE_BYTES = 4096
MAX_MEMBERS = 20_000
MAX_TOTAL_BYTES = 512 * 1024 * 1024
_READ_CHUNK = 1024 * 1024

#: Oeffentlicher Ed25519-Schluessel der offiziellen Releases, base64-kodiert
#: (32 Rohbytes). Wird beim Release-Prozess gesetzt. Leer heisst: es gilt
#: ausschliesslich, was der Betreiber in ``UPDATE_BUNDLE_PUBKEYS`` hinterlegt -
#: bewusst kein Fallback auf "ungeprueft akzeptieren".
RELEASE_PUBLIC_KEY = ""

_VERSION_RE = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)$")


#: Ablehnungsgruende, die nach aussen gehen duerfen. Bewusst eine kurze,
#: geschlossene Liste statt der Fehlermeldung selbst: Die Meldungen enthalten
#: Dateinamen, Serverpfade und Text fremder Ausnahmen und gehoeren damit ins
#: Log, nicht in eine HTTP-Antwort. Die Uebersetzung macht das Frontend, sonst
#: stuende hier deutscher Text in einer englischen Oberflaeche.
ERR_NO_KEY = "no_key"
ERR_NOT_A_BUNDLE = "not_a_bundle"
ERR_SIGNATURE = "signature_mismatch"
ERR_CONTENT = "content_mismatch"
ERR_UNSAFE = "unsafe_archive"
ERR_FORMAT = "format_unsupported"
ERR_MIN_VERSION = "min_version"
ERR_DOWNGRADE = "downgrade"


class BundleError(Exception):
    """Bundle ist unbrauchbar - Signatur, Inhalt oder Versionskette passen nicht.

    ``code`` ist der nach aussen gereichte Grund (siehe ERR_*), ``message`` die
    ausfuehrliche Begruendung fuer Log und CLI.
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class BundleInfo:
    """Ergebnis einer erfolgreichen Pruefung."""

    target_version: str
    min_version: str
    created_at: str | None
    key_id: str
    file_count: int
    total_bytes: int
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "target_version": self.target_version,
            "min_version": self.min_version,
            "created_at": self.created_at,
            "key_id": self.key_id,
            "file_count": self.file_count,
            "total_bytes": self.total_bytes,
            "current_version": APP_VERSION,
            "notes": self.notes,
        }


def parse_version(value: str | None) -> tuple[int, int, int]:
    """Strikte Semver-Zerlegung. Anders als beim Update-Check wird hier nicht
    aus einem Fliesstext geraten - ein Bundle muss eine exakte Version nennen."""
    if not value:
        raise BundleError(ERR_NOT_A_BUNDLE, "Versionsangabe fehlt")
    m = _VERSION_RE.match(value.strip())
    if not m:
        raise BundleError(ERR_NOT_A_BUNDLE, f"Versionsangabe nicht lesbar: {value!r}")
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def key_id_for(public_key: bytes) -> str:
    """Kurzkennung eines Schluessels (erste 16 Hex-Zeichen des SHA-256)."""
    return hashlib.sha256(public_key).hexdigest()[:16]


def _decode_key(raw: str) -> bytes:
    try:
        key = base64.b64decode(raw.strip(), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise BundleError(ERR_NO_KEY, f"Oeffentlicher Schluessel ist kein gueltiges Base64: {exc}") from exc
    if len(key) != 32:
        raise BundleError(ERR_NO_KEY, f"Oeffentlicher Schluessel hat {len(key)} statt 32 Bytes")
    return key


def trusted_public_keys(extra: str | None = None) -> list[bytes]:
    """Alle akzeptierten Signaturschluessel: eingebauter Release-Schluessel plus
    die vom Betreiber in ``UPDATE_BUNDLE_PUBKEYS`` hinterlegten (kommagetrennt).

    Der Betreiber-Eintrag ergaenzt, er ersetzt nicht - eine eigene Instanz kann
    zusaetzlich selbst signierte Bundles akzeptieren, ohne dass dabei der
    offizielle Schluessel verlorengeht.
    """
    sources = [RELEASE_PUBLIC_KEY]
    if extra is None:
        from app.config import get_settings

        extra = get_settings().UPDATE_BUNDLE_PUBKEYS
    sources.extend((extra or "").split(","))
    keys: list[bytes] = []
    for raw in sources:
        if raw and raw.strip():
            key = _decode_key(raw)
            if key not in keys:
                keys.append(key)
    return keys


def _safe_member_name(name: str) -> str:
    """Weist Pfade zurueck, die beim Entpacken aus dem Zielverzeichnis fuehren.

    Geprueft wird schon beim Lesen, nicht erst beim Entpacken: Ein Bundle mit
    einem solchen Pfad gilt als manipuliert und wird komplett verworfen.
    """
    if name.startswith(("/", "\\")):
        raise BundleError(ERR_UNSAFE, f"Absoluter Pfad im Archiv: {name}")
    if ".." in name.replace("\\", "/").split("/"):
        raise BundleError(ERR_UNSAFE, f"Pfad fuehrt aus dem Zielverzeichnis: {name}")
    if ":" in name.split("/")[0] and len(name.split("/")[0]) == 2:
        raise BundleError(ERR_UNSAFE, f"Laufwerksangabe im Pfad: {name}")
    return name


def _reject_env_file(name: str) -> None:
    """Weist ``.env`` und ``.env.*`` an jeder Stelle der Nutzlast zurueck.

    Das Bau-Werkzeug schliesst diese Dateien bereits aus, aber ein Bundle kann
    von einem beliebigen Werkzeug erzeugt worden sein. Die Pruefung ist die
    einzige Stelle, die das erzwingen kann, und sie muss es erzwingen: Die
    Betreiber-``.env`` traegt DB-Passwort, ``SECRET_KEY`` und die
    Fernet-abgeleiteten Laufzeit-Credentials. Ein Bundle, das sie mitbringt,
    wuerde sie beim Einspielen ueberschreiben - im harmlosen Fall versehentlich
    mit den Entwicklungswerten des Erstellers.
    """
    leaf = name.rsplit("/", 1)[-1]
    if leaf == ".env" or leaf.startswith(".env."):
        raise BundleError(ERR_UNSAFE, f"Bundle enthaelt eine .env-Datei: {name}")


def _read_member(tar: tarfile.TarFile, member: tarfile.TarInfo, limit: int) -> bytes:
    if member.size > limit:
        raise BundleError(ERR_UNSAFE, f"{member.name} ist groesser als erlaubt ({member.size} > {limit} Bytes)")
    handle = tar.extractfile(member)
    if handle is None:
        raise BundleError(ERR_NOT_A_BUNDLE, f"{member.name} ist nicht lesbar")
    with handle:
        return handle.read(limit + 1)[:limit]


def _verify_signature(manifest_bytes: bytes, signature: bytes, keys: list[bytes]) -> bytes:
    """Gibt den Schluessel zurueck, unter dem die Signatur aufgeht."""
    for key in keys:
        try:
            Ed25519PublicKey.from_public_bytes(key).verify(signature, manifest_bytes)
            return key
        except InvalidSignature:
            continue
    raise BundleError(
        ERR_SIGNATURE,
        "Signatur passt zu keinem hinterlegten Schluessel. Bundle stammt nicht aus "
        "einer vertrauenswuerdigen Quelle oder wurde nachtraeglich veraendert."
    )


def _check_version_chain(manifest: dict, current: str) -> list[str]:
    notes: list[str] = []
    running = parse_version(current)
    target = parse_version(manifest.get("target_version"))
    minimum = parse_version(manifest.get("min_version"))

    if running < minimum:
        raise BundleError(
            ERR_MIN_VERSION,
            f"Bundle setzt mindestens Version {'.'.join(map(str, minimum))} voraus, "
            f"installiert ist {current}. Zwischenrelease zuerst einspielen."
        )
    if target < running:
        raise BundleError(
            ERR_DOWNGRADE,
            f"Bundle enthaelt Version {'.'.join(map(str, target))}, installiert ist "
            f"bereits {current}. Ein Downgrade wird nicht eingespielt."
        )
    if target == running:
        notes.append(f"Bundle entspricht der bereits installierten Version {current}.")
    return notes


def verify_bundle(path: str, *, extra_keys: str | None = None, current_version: str | None = None) -> BundleInfo:
    """Prueft ein Bundle vollstaendig. Erfolg = Rueckgabe, Fehler = ``BundleError``.

    Es wird nichts entpackt und nichts geschrieben.
    """
    keys = trusted_public_keys(extra_keys)
    if not keys:
        raise BundleError(
            ERR_NO_KEY,
            "Kein Signaturschluessel hinterlegt. UPDATE_BUNDLE_PUBKEYS in der .env "
            "setzen - ohne Schluessel wird kein Bundle akzeptiert."
        )

    # Der gesamte Lesevorgang steht im try: Ein abgeschnittenes oder beschaedigtes
    # Archiv faellt nicht schon beim Oeffnen auf, sondern erst mitten im Lesen.
    try:
        with tarfile.open(path, "r:gz") as tar:
            manifest_bytes: bytes | None = None
            signature_raw: bytes | None = None
            payload: dict[str, tarfile.TarInfo] = {}
            total = 0
            seen = 0

            for member in tar:
                seen += 1
                if seen > MAX_MEMBERS:
                    raise BundleError(ERR_UNSAFE, f"Archiv enthaelt mehr als {MAX_MEMBERS} Eintraege")
                if member.isdir():
                    _safe_member_name(member.name)
                    continue
                if not member.isreg():
                    # Symlinks, Hardlinks und Geraetedateien haben in einem Update-
                    # Bundle nichts zu suchen und sind der klassische Ausbruchspfad.
                    raise BundleError(ERR_UNSAFE, f"Unerlaubter Eintragstyp im Archiv: {member.name}")
                name = _safe_member_name(member.name)
                total += member.size
                if total > MAX_TOTAL_BYTES:
                    raise BundleError(ERR_UNSAFE, f"Archiv ist entpackt groesser als {MAX_TOTAL_BYTES} Bytes")
                if name == MANIFEST_NAME:
                    manifest_bytes = _read_member(tar, member, MAX_MANIFEST_BYTES)
                elif name == SIGNATURE_NAME:
                    signature_raw = _read_member(tar, member, MAX_SIGNATURE_BYTES)
                elif name.startswith(PAYLOAD_PREFIX):
                    _reject_env_file(name)
                    payload[name] = member
                else:
                    raise BundleError(ERR_CONTENT, f"Unerwartete Datei im Archiv: {name}")

            if manifest_bytes is None:
                raise BundleError(ERR_NOT_A_BUNDLE, f"{MANIFEST_NAME} fehlt im Bundle")
            if signature_raw is None:
                raise BundleError(ERR_NOT_A_BUNDLE, f"{SIGNATURE_NAME} fehlt im Bundle")

            try:
                signature = base64.b64decode(signature_raw.strip(), validate=True)
            except (binascii.Error, ValueError) as exc:
                raise BundleError(ERR_NOT_A_BUNDLE, f"Signatur ist kein gueltiges Base64: {exc}") from exc

            key = _verify_signature(manifest_bytes, signature, keys)

            try:
                manifest = json.loads(manifest_bytes)
            except ValueError as exc:
                raise BundleError(ERR_NOT_A_BUNDLE, f"Manifest ist kein gueltiges JSON: {exc}") from exc
            if not isinstance(manifest, dict):
                raise BundleError(ERR_NOT_A_BUNDLE, "Manifest ist kein JSON-Objekt")

            if manifest.get("format") != BUNDLE_FORMAT:
                raise BundleError(
                    ERR_FORMAT,
                    f"Unbekannte Bundle-Formatversion {manifest.get('format')!r} "
                    f"(erwartet {BUNDLE_FORMAT}). Neuere SentryMail-Version noetig."
                )

            notes = _check_version_chain(manifest, current_version or APP_VERSION)

            entries = manifest.get("files")
            if not isinstance(entries, list) or not entries:
                raise BundleError(ERR_NOT_A_BUNDLE, "Manifest enthaelt keine Dateiliste")

            expected: dict[str, str] = {}
            for entry in entries:
                if not isinstance(entry, dict):
                    raise BundleError(ERR_NOT_A_BUNDLE, "Fehlerhafter Eintrag in der Dateiliste")
                name = _safe_member_name(str(entry.get("path", "")))
                digest = str(entry.get("sha256", "")).lower()
                if not name.startswith(PAYLOAD_PREFIX):
                    raise BundleError(ERR_UNSAFE, f"Manifest listet eine Datei ausserhalb von {PAYLOAD_PREFIX}: {name}")
                # Auch im Manifest, nicht nur im Archiv: sonst faellt eine
                # gelistete .env erst als Inhalts-Abweichung auf, mit
                # irrefuehrendem Grund.
                _reject_env_file(name)
                if len(digest) != 64 or not all(c in "0123456789abcdef" for c in digest):
                    raise BundleError(ERR_NOT_A_BUNDLE, f"Ungueltiger SHA-256-Wert fuer {name}")
                expected[name] = digest

            # Beide Richtungen pruefen: keine Datei ohne Manifest-Eintrag und kein
            # Manifest-Eintrag ohne Datei. Nur eine Richtung liesse zu, dass ein
            # Angreifer eine zusaetzliche Datei einschmuggelt oder eine entfernt.
            if set(expected) != set(payload):
                missing = sorted(set(expected) - set(payload))
                extra = sorted(set(payload) - set(expected))
                details = []
                if missing:
                    details.append(f"fehlt: {', '.join(missing[:5])}")
                if extra:
                    details.append(f"nicht im Manifest: {', '.join(extra[:5])}")
                raise BundleError(
                    ERR_CONTENT, "Archivinhalt weicht vom Manifest ab (" + "; ".join(details) + ")"
                )

            for name, member in sorted(payload.items()):
                handle = tar.extractfile(member)
                if handle is None:
                    raise BundleError(ERR_NOT_A_BUNDLE, f"{name} ist nicht lesbar")
                digest = hashlib.sha256()
                with handle:
                    while chunk := handle.read(_READ_CHUNK):
                        digest.update(chunk)
                if digest.hexdigest() != expected[name]:
                    raise BundleError(ERR_CONTENT, f"Pruefsumme weicht ab: {name}")
    except (tarfile.TarError, OSError) as exc:
        raise BundleError(ERR_NOT_A_BUNDLE, f"Archiv nicht lesbar: {exc}") from exc

    return BundleInfo(
        target_version=str(manifest["target_version"]),
        min_version=str(manifest["min_version"]),
        created_at=manifest.get("created_at"),
        key_id=key_id_for(key),
        file_count=len(payload),
        total_bytes=total,
        notes=notes,
    )


def _main(argv: list[str]) -> int:
    """CLI fuer ``update.sh``: Exit 0 = Bundle in Ordnung, 1 = abgelehnt."""
    if len(argv) != 1:
        print("Aufruf: python -m app.services.update_bundle <bundle.tar.gz>")
        return 2
    try:
        info = verify_bundle(argv[0])
    except BundleError as exc:
        # Auf der Kommandozeile steht der ausfuehrliche Text: Sie laeuft beim
        # Betreiber selbst, nicht ueber HTTP - hier ist Detail hilfreich.
        print(f"ABGELEHNT [{exc.code}]: {exc.message}")
        return 1
    print(json.dumps(info.as_dict(), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":  # pragma: no cover - Einstiegspunkt
    import sys

    sys.exit(_main(sys.argv[1:]))
