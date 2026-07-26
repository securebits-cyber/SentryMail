#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Prueft ein SentryMail-Nachweispaket - ohne SentryMail.

Ohne unabhaengige Pruefbarkeit ist "revisionssicher" nur ein Wort. Dieses
Werkzeug ist deshalb bewusst genuegsam:

* **nur die Python-Standardbibliothek** - keine Installation, keine Abhaengigkeiten
* **keine Datenbank**, **kein Netz**, **kein SentryMail**
* eine einzige Datei, die man mitgeben und selbst nachlesen kann

Aufruf::

    python verify.py sentrymail-nachweis-20260726-120000.zip

Exit-Code 0 = Kette in Ordnung, 1 = Bruch gefunden, 2 = Paket unlesbar.

Sprache der Ausgabe ueber ``--lang de|en`` (Vorgabe: de).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile

GENESIS_HASH = "0" * 64

#: Vom Werkzeug unterstuetzte Formate. Ein neueres Paket wird abgelehnt statt
#: geraten - eine falsche Zusicherung waere schlimmer als keine.
SUPPORTED_FORMATS = (1,)
SUPPORTED_CANONICAL = (1,)

#: Felder, die in den Hash eingehen, in genau dieser Bedeutung. Die Reihenfolge
#: spielt keine Rolle - json.dumps sortiert -, die Namen schon.
HASHED_FIELDS = (
    "seq",
    "created_at",
    "actor_email",
    "actor_name",
    "category",
    "action",
    "description",
    "ip",
    "prev_hash",
)

TEXTS = {
    "de": {
        "usage": "Aufruf: python verify.py <nachweispaket.zip>",
        "unreadable": "Paket nicht lesbar: {err}",
        "missing": "Datei fehlt im Paket: {name}",
        "bad_manifest": "Manifest unbrauchbar: {err}",
        "unsupported": "Paketformat {fmt} wird von diesem Werkzeug nicht unterstuetzt (bekannt: {known}). Neuere Fassung des Werkzeugs verwenden.",
        "header": "Nachweispaket: {entries} Eintraege, erzeugt {exported} (SentryMail {version})",
        "gap": "Luecke vor Eintrag {seq}: erwartet wurde {expected}. Ein Eintrag wurde entfernt.",
        "broken": "Verkettung gebrochen bei Eintrag {seq}: Vorgaenger-Hash passt nicht.",
        "altered": "Inhalt veraendert bei Eintrag {seq}: der Hash passt nicht zum Inhalt.",
        "head": "Kettenkopf stimmt nicht mit dem Manifest ueberein.",
        "count": "Eintragszahl weicht vom Manifest ab: {actual} statt {expected}.",
        "ok": "Kette in Ordnung. {entries} Eintraege, keine Luecken, keine Aenderungen.",
        "purged": "Davon {n} Tombstones - Inhalt wegen Aufbewahrungsfrist geloescht, Verkettung geprueft.",
        "failed": "{n} Befund(e). Die Kette ist nicht unveraendert.",
    },
    "en": {
        "usage": "Usage: python verify.py <evidence-package.zip>",
        "unreadable": "Package not readable: {err}",
        "missing": "File missing from the package: {name}",
        "bad_manifest": "Manifest unusable: {err}",
        "unsupported": "Package format {fmt} is not supported by this tool (known: {known}). Use a newer version of the tool.",
        "header": "Evidence package: {entries} entries, created {exported} (SentryMail {version})",
        "gap": "Gap before entry {seq}: expected {expected}. An entry was removed.",
        "broken": "Chain broken at entry {seq}: the predecessor hash does not match.",
        "altered": "Content altered at entry {seq}: the hash does not match the content.",
        "head": "The chain head does not match the manifest.",
        "count": "Entry count differs from the manifest: {actual} instead of {expected}.",
        "ok": "Chain intact. {entries} entries, no gaps, no changes.",
        "purged": "Of these, {n} are tombstones - content deleted under a retention policy, linkage verified.",
        "failed": "{n} finding(s). The chain is not unchanged.",
    },
}


def canonical_bytes(entry: dict, canonical_version: int) -> bytes:
    """Muss byte-genau dem entsprechen, was SentryMail beim Anhaengen bildet."""
    payload = {"v": canonical_version}
    for field in HASHED_FIELDS:
        value = entry.get(field)
        payload[field] = value if field == "seq" else (value or "")
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode(
        "utf-8"
    )


def verify(entries: list[dict], manifest: dict, t: dict) -> list[str]:
    """Prueft Verkettung, Luecken und Inhalte. Gibt die Befunde zurueck."""
    problems: list[str] = []
    canonical_version = manifest.get("canonical_version", 1)
    expected_prev = manifest.get("genesis_hash", GENESIS_HASH)
    expected_seq: int | None = None

    for entry in entries:
        seq = entry.get("seq")
        if expected_seq is not None and seq != expected_seq:
            problems.append(t["gap"].format(seq=seq, expected=expected_seq))
        if entry.get("prev_hash") != expected_prev:
            problems.append(t["broken"].format(seq=seq))
        # Tombstones koennen ihren Inhalts-Hash nicht mehr bestaetigen: Der
        # Inhalt wurde wegen einer Aufbewahrungsfrist geloescht. Die Kette
        # bleibt trotzdem pruefbar - genau dafuer ist sie so gebaut.
        if not entry.get("content_purged"):
            computed = hashlib.sha256(canonical_bytes(entry, canonical_version)).hexdigest()
            if computed != entry.get("entry_hash"):
                problems.append(t["altered"].format(seq=seq))

        expected_prev = entry.get("entry_hash")
        expected_seq = (seq + 1) if isinstance(seq, int) else None

    if manifest.get("entries") != len(entries):
        problems.append(t["count"].format(actual=len(entries), expected=manifest.get("entries")))
    if entries and manifest.get("head_hash") != entries[-1].get("entry_hash"):
        problems.append(t["head"])

    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("package", nargs="?", help="Nachweispaket (.zip)")
    parser.add_argument("--lang", choices=("de", "en"), default="de")
    args = parser.parse_args(argv)

    t = TEXTS[args.lang]
    if not args.package:
        print(t["usage"])
        return 2

    try:
        with zipfile.ZipFile(args.package) as archive:
            names = set(archive.namelist())
            for required in ("events.jsonl", "manifest.json"):
                if required not in names:
                    print(t["missing"].format(name=required))
                    return 2
            manifest_raw = archive.read("manifest.json").decode("utf-8")
            events_raw = archive.read("events.jsonl").decode("utf-8")
    except (OSError, zipfile.BadZipFile, UnicodeDecodeError) as exc:
        print(t["unreadable"].format(err=exc))
        return 2

    try:
        manifest = json.loads(manifest_raw)
    except ValueError as exc:
        print(t["bad_manifest"].format(err=exc))
        return 2

    fmt = manifest.get("format")
    canonical = manifest.get("canonical_version", 1)
    if fmt not in SUPPORTED_FORMATS or canonical not in SUPPORTED_CANONICAL:
        # Lieber ehrlich abbrechen als eine Kette fuer gebrochen erklaeren, die
        # dieses Werkzeug schlicht nicht versteht.
        print(t["unsupported"].format(fmt=f"{fmt}/{canonical}", known=SUPPORTED_FORMATS))
        return 2

    entries = []
    for line in events_raw.splitlines():
        if line.strip():
            try:
                entries.append(json.loads(line))
            except ValueError as exc:
                print(t["unreadable"].format(err=exc))
                return 2

    print(
        t["header"].format(
            entries=len(entries),
            exported=manifest.get("exported_at", "?"),
            version=manifest.get("app_version", "?"),
        )
    )

    problems = verify(entries, manifest, t)
    if problems:
        for problem in problems:
            print(f"  ! {problem}")
        print(t["failed"].format(n=len(problems)))
        return 1

    print(t["ok"].format(entries=len(entries)))
    purged = sum(1 for e in entries if e.get("content_purged"))
    if purged:
        print(t["purged"].format(n=purged))
    return 0


if __name__ == "__main__":
    sys.exit(main())
