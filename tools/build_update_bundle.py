#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Erzeugt ein signiertes Offline-Update-Bundle (Welle 8).

Ein Bundle bringt eine SentryMail-Version auf eine Installation ohne
Internetzugang. Es besteht aus:

    manifest.json   Zielversion, Mindestversion, SHA-256 je Datei
    manifest.sig    Ed25519-Signatur (base64) ueber die rohen Manifest-Bytes
    payload/...     der auszuliefernde Quellbaum

Geprueft wird beim Kunden von ``app/services/update_bundle.py`` bzw.
``update.sh --bundle``. Das Format ist dort beschrieben und verbindlich.

Schluesselpaar anlegen (einmalig, privater Schluessel gehoert in den
Release-Tresor und niemals ins Repo)::

    python tools/build_update_bundle.py keygen --out release-key

Bundle bauen::

    python tools/build_update_bundle.py build \\
        --source . --key release-key.priv \\
        --target-version 0.38.0 --min-version 0.30.0 \\
        --out dist/sentrymail-update-0.38.0.tar.gz

Der oeffentliche Schluessel wird beim Bau ausgegeben; er gehoert in
``RELEASE_PUBLIC_KEY`` (offizielle Releases) oder beim Betreiber in
``UPDATE_BUNDLE_PUBKEYS``.

Byte-identisch reproduzierbar wird ein Bundle mit gesetztem
``SOURCE_DATE_EPOCH`` - dann ist auch ``created_at`` deterministisch und damit
das signierte Manifest::

    SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) python tools/build_update_bundle.py build ...
"""
from __future__ import annotations

import argparse
import base64
import fnmatch
import gzip
import hashlib
import io
import json
import os
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

BUNDLE_FORMAT = 1
PAYLOAD_PREFIX = "payload/"

#: Was nie in ein Bundle gehoert. Die .env steht bewusst ganz oben: Ein Bundle
#: wird weitergereicht, und eine mitgelieferte .env waere ein Secret-Leck.
EXCLUDE = [
    ".env",
    ".env.*",
    ".git",
    ".git/*",
    "*/.git/*",
    "__pycache__",
    "*/__pycache__/*",
    "*.pyc",
    "node_modules",
    "*/node_modules/*",
    "backups",
    "backups/*",
    "dist",
    "dist/*",
    ".venv",
    ".venv/*",
    "*.tar.gz",
]


def _excluded(rel: str) -> bool:
    parts = rel.split("/")
    for pattern in EXCLUDE:
        if fnmatch.fnmatch(rel, pattern):
            return True
        if any(fnmatch.fnmatch(part, pattern) for part in parts):
            return True
    return False


def _collect(source: Path) -> list[tuple[Path, str]]:
    """Alle einzuschliessenden Dateien als (absoluter Pfad, Archivname).

    Sortiert, damit derselbe Quellbaum immer dasselbe Manifest ergibt -
    reproduzierbare Bundles sind bei einem signierten Artefakt kein Luxus.
    """
    found: list[tuple[Path, str]] = []
    for root, dirs, files in os.walk(source):
        rel_root = os.path.relpath(root, source)
        rel_root = "" if rel_root == "." else rel_root.replace(os.sep, "/")
        dirs[:] = sorted(d for d in dirs if not _excluded(f"{rel_root}/{d}".lstrip("/")))
        for name in sorted(files):
            rel = f"{rel_root}/{name}".lstrip("/")
            path = Path(root) / name
            if _excluded(rel) or path.is_symlink():
                continue
            found.append((path, PAYLOAD_PREFIX + rel))
    return sorted(found, key=lambda item: item[1])


def _sha256(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def _add_bytes(tar: tarfile.TarFile, name: str, payload: bytes) -> None:
    info = tarfile.TarInfo(name)
    info.size = len(payload)
    info.mtime = 0  # feste mtime -> reproduzierbares Archiv
    info.mode = 0o644
    tar.addfile(info, io.BytesIO(payload))


def cmd_keygen(args: argparse.Namespace) -> int:
    private = Ed25519PrivateKey.generate()
    raw_private = private.private_bytes_raw()
    raw_public = private.public_key().public_bytes_raw()

    priv_path = Path(f"{args.out}.priv")
    if priv_path.exists() and not args.force:
        print(f"FEHLER: {priv_path} existiert bereits (--force zum Ueberschreiben).", file=sys.stderr)
        return 1
    priv_path.write_text(base64.b64encode(raw_private).decode() + "\n")
    os.chmod(priv_path, 0o600)
    Path(f"{args.out}.pub").write_text(base64.b64encode(raw_public).decode() + "\n")

    print(f"Privater Schluessel: {priv_path} (chmod 600 - NIEMALS ins Repo)")
    print(f"Oeffentlicher Schluessel: {args.out}.pub")
    print(f"UPDATE_BUNDLE_PUBKEYS={base64.b64encode(raw_public).decode()}")
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    source = Path(args.source).resolve()
    if not source.is_dir():
        print(f"FEHLER: {source} ist kein Verzeichnis.", file=sys.stderr)
        return 1

    key_raw = base64.b64decode(Path(args.key).read_text().strip(), validate=True)
    if len(key_raw) != 32:
        print("FEHLER: privater Schluessel hat nicht 32 Rohbytes.", file=sys.stderr)
        return 1
    private = Ed25519PrivateKey.from_private_bytes(key_raw)

    files = _collect(source)
    if not files:
        print("FEHLER: keine Dateien zum Ausliefern gefunden.", file=sys.stderr)
        return 1

    entries = []
    for path, arcname in files:
        digest, size = _sha256(path)
        entries.append({"path": arcname, "sha256": digest, "size": size})

    # SOURCE_DATE_EPOCH (Konvention reproduzierbarer Builds) macht den einzigen
    # veraenderlichen Wert im Manifest deterministisch. Ohne die Variable steht
    # hier die aktuelle Zeit - dann ist das Bundle nicht byte-identisch
    # reproduzierbar, was fuer den Normalbetrieb genuegt.
    epoch = os.environ.get("SOURCE_DATE_EPOCH", "").strip()
    created = (
        datetime.fromtimestamp(int(epoch), timezone.utc) if epoch.isdigit() else datetime.now(timezone.utc)
    )
    manifest = {
        "format": BUNDLE_FORMAT,
        "product": "sentrymail",
        "target_version": args.target_version,
        "min_version": args.min_version,
        "created_at": created.isoformat(timespec="seconds"),
        "files": entries,
    }
    # sort_keys + feste Trennzeichen: Die Bytes, die signiert werden, muessen
    # exakt die Bytes sein, die im Archiv landen.
    manifest_bytes = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    signature = base64.b64encode(private.sign(manifest_bytes))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    # Der gzip-Container traegt einen eigenen Zeitstempel im Header. Wird er
    # nicht festgenagelt, unterscheiden sich zwei Baeufe derselben Quelle trotz
    # identischem tar-Inhalt. Ueber ein GzipFile mit mtime=0 statt "w:gz";
    # ausserdem schreibt der fileobj-Weg keinen Dateinamen in den Header.
    with (
        out.open("wb") as raw,
        # filename="" unterdrueckt das FNAME-Feld: sonst uebernimmt GzipFile den
        # Namen des fileobj, und zwei Baeufe mit verschiedenem Ausgabenamen
        # unterscheiden sich im Header trotz identischem Inhalt.
        gzip.GzipFile(filename="", fileobj=raw, mode="wb", mtime=0) as gz,
        tarfile.open(fileobj=gz, mode="w", format=tarfile.PAX_FORMAT) as tar,
    ):
        _add_bytes(tar, "manifest.json", manifest_bytes)
        _add_bytes(tar, "manifest.sig", signature + b"\n")
        for path, arcname in files:
            info = tar.gettarinfo(str(path), arcname=arcname)
            info.mtime = 0
            info.uid = info.gid = 0
            info.uname = info.gname = ""
            info.mode = 0o755 if os.access(path, os.X_OK) else 0o644
            with path.open("rb") as handle:
                tar.addfile(info, handle)

    public_b64 = base64.b64encode(private.public_key().public_bytes_raw()).decode()
    print(f"Bundle: {out} ({out.stat().st_size} Bytes, {len(files)} Dateien)")
    print(f"Zielversion: {args.target_version} (mindestens {args.min_version})")
    print(f"Oeffentlicher Schluessel: {public_b64}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    keygen = sub.add_parser("keygen", help="Ed25519-Schluesselpaar erzeugen")
    keygen.add_argument("--out", default="release-key", help="Basisname (erzeugt .priv und .pub)")
    keygen.add_argument("--force", action="store_true", help="vorhandenen privaten Schluessel ueberschreiben")
    keygen.set_defaults(func=cmd_keygen)

    build = sub.add_parser("build", help="Bundle bauen und signieren")
    build.add_argument("--source", default=".", help="Quellbaum (Default: aktuelles Verzeichnis)")
    build.add_argument("--key", required=True, help="privater Ed25519-Schluessel (base64, aus keygen)")
    build.add_argument("--target-version", required=True, help="Version im Bundle, z. B. 0.38.0")
    build.add_argument("--min-version", required=True, help="mindestens installierte Version, z. B. 0.30.0")
    build.add_argument("--out", required=True, help="Zieldatei (.tar.gz)")
    build.set_defaults(func=cmd_build)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
