# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Pruefung signierter Offline-Update-Bundles (Welle 8).

Die Tests bauen echte Bundles mit einem Wegwerf-Schluessel und manipulieren sie
anschliessend gezielt. Der Kern ist nicht der Erfolgsfall, sondern dass jede
einzelne Manipulation zuverlaessig abgelehnt wird.
"""
import base64
import hashlib
import io
import json
import tarfile

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.services.update_bundle import (
    ERR_CONTENT,
    ERR_DOWNGRADE,
    ERR_FORMAT,
    ERR_MIN_VERSION,
    ERR_NO_KEY,
    ERR_NOT_A_BUNDLE,
    ERR_SIGNATURE,
    ERR_UNSAFE,
    BundleError,
    key_id_for,
    parse_version,
    trusted_public_keys,
    verify_bundle,
)

CURRENT = "0.37.1"


@pytest.fixture
def keypair():
    private = Ed25519PrivateKey.generate()
    public_b64 = base64.b64encode(private.public_key().public_bytes_raw()).decode()
    return private, public_b64


def _add(tar, name, payload, mode=0o644):
    info = tarfile.TarInfo(name)
    info.size = len(payload)
    info.mtime = 0
    info.mode = mode
    tar.addfile(info, io.BytesIO(payload))


def make_bundle(
    tmp_path,
    private,
    *,
    files=None,
    target_version="0.38.0",
    min_version="0.30.0",
    fmt=1,
    manifest_mutator=None,
    extra_members=None,
    drop_files=(),
    sign_with=None,
):
    """Baut ein Bundle. Alle Abweichungen vom Gutfall sind Parameter."""
    files = files if files is not None else {"payload/backend/app/main.py": b"print('hi')\n"}
    entries = [
        {
            "path": name,
            "sha256": hashlib.sha256(data).hexdigest(),
            "size": len(data),
        }
        for name, data in sorted(files.items())
    ]
    manifest = {
        "format": fmt,
        "product": "sentrymail",
        "target_version": target_version,
        "min_version": min_version,
        "created_at": "2026-07-26T10:00:00+00:00",
        "files": entries,
    }
    if manifest_mutator:
        manifest_mutator(manifest)
    manifest_bytes = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
    signer = sign_with or private
    signature = base64.b64encode(signer.sign(manifest_bytes))

    path = tmp_path / "bundle.tar.gz"
    with tarfile.open(path, "w:gz") as tar:
        _add(tar, "manifest.json", manifest_bytes)
        _add(tar, "manifest.sig", signature + b"\n")
        for name, data in sorted(files.items()):
            if name in drop_files:
                continue
            _add(tar, name, data)
        for name, data in (extra_members or {}).items():
            _add(tar, name, data)
    return str(path)


# --- Gutfall ----------------------------------------------------------------


def test_valid_bundle_is_accepted(tmp_path, keypair):
    private, public_b64 = keypair
    path = make_bundle(tmp_path, private)
    info = verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)
    assert info.target_version == "0.38.0"
    assert info.file_count == 1
    assert info.key_id == key_id_for(private.public_key().public_bytes_raw())
    assert info.notes == []


def test_same_version_is_accepted_with_note(tmp_path, keypair):
    private, public_b64 = keypair
    path = make_bundle(tmp_path, private, target_version=CURRENT)
    info = verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)
    assert info.notes and CURRENT in info.notes[0]


# --- Signatur ---------------------------------------------------------------


def test_wrong_key_is_rejected(tmp_path, keypair):
    private, _ = keypair
    other = Ed25519PrivateKey.generate()
    other_pub = base64.b64encode(other.public_key().public_bytes_raw()).decode()
    path = make_bundle(tmp_path, private)
    with pytest.raises(BundleError, match="Signatur passt zu keinem"):
        verify_bundle(path, extra_keys=other_pub, current_version=CURRENT)


def test_tampered_manifest_breaks_signature(tmp_path, keypair):
    private, public_b64 = keypair
    path = make_bundle(tmp_path, private)

    # Manifest nachtraeglich austauschen, Signatur unveraendert lassen.
    with tarfile.open(path, "r:gz") as tar:
        members = {m.name: (m, tar.extractfile(m).read()) for m in tar if m.isreg()}
    manifest = json.loads(members["manifest.json"][1])
    manifest["target_version"] = "9.9.9"
    with tarfile.open(path, "w:gz") as tar:
        for name, (_m, data) in members.items():
            if name == "manifest.json":
                data = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
            _add(tar, name, data)

    with pytest.raises(BundleError, match="Signatur passt zu keinem"):
        verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)


def test_no_configured_key_rejects_everything(tmp_path, keypair):
    private, _ = keypair
    path = make_bundle(tmp_path, private)
    with pytest.raises(BundleError, match="Kein Signaturschluessel"):
        verify_bundle(path, extra_keys="", current_version=CURRENT)


# --- Inhalt -----------------------------------------------------------------


def test_modified_payload_fails_checksum(tmp_path, keypair):
    private, public_b64 = keypair
    files = {"payload/app.py": b"original\n"}
    path = make_bundle(tmp_path, private, files=files)

    with tarfile.open(path, "r:gz") as tar:
        members = [(m.name, tar.extractfile(m).read()) for m in tar if m.isreg()]
    with tarfile.open(path, "w:gz") as tar:
        for name, data in members:
            _add(tar, name, b"boesartig\n" if name == "payload/app.py" else data)

    with pytest.raises(BundleError, match="Pruefsumme weicht ab"):
        verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)


def test_extra_file_not_in_manifest_is_rejected(tmp_path, keypair):
    private, public_b64 = keypair
    path = make_bundle(tmp_path, private, extra_members={"payload/hintertuer.py": b"x\n"})
    with pytest.raises(BundleError, match="nicht im Manifest"):
        verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)


def test_missing_file_from_manifest_is_rejected(tmp_path, keypair):
    private, public_b64 = keypair
    files = {"payload/a.py": b"a\n", "payload/b.py": b"b\n"}
    path = make_bundle(tmp_path, private, files=files, drop_files=("payload/b.py",))
    with pytest.raises(BundleError, match="fehlt"):
        verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)


def test_file_outside_payload_is_rejected(tmp_path, keypair):
    private, public_b64 = keypair
    path = make_bundle(tmp_path, private, extra_members={"woanders.py": b"x\n"})
    with pytest.raises(BundleError, match="Unerwartete Datei"):
        verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)


def test_path_traversal_is_rejected(tmp_path, keypair):
    private, public_b64 = keypair
    path = make_bundle(tmp_path, private, extra_members={"payload/../../etc/passwd": b"x\n"})
    with pytest.raises(BundleError, match="fuehrt aus dem Zielverzeichnis"):
        verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)


def test_symlink_member_is_rejected(tmp_path, keypair):
    private, public_b64 = keypair
    path = make_bundle(tmp_path, private)
    with tarfile.open(path, "r:gz") as tar:
        members = [(m.name, tar.extractfile(m).read()) for m in tar if m.isreg()]
    with tarfile.open(path, "w:gz") as tar:
        for name, data in members:
            _add(tar, name, data)
        link = tarfile.TarInfo("payload/link")
        link.type = tarfile.SYMTYPE
        link.linkname = "/etc/shadow"
        tar.addfile(link)
    with pytest.raises(BundleError, match="Unerlaubter Eintragstyp"):
        verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)


# --- Versionskette ----------------------------------------------------------


def test_min_version_above_current_is_rejected(tmp_path, keypair):
    private, public_b64 = keypair
    path = make_bundle(tmp_path, private, target_version="0.50.0", min_version="0.40.0")
    with pytest.raises(BundleError, match="Zwischenrelease"):
        verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)


def test_downgrade_is_rejected(tmp_path, keypair):
    private, public_b64 = keypair
    path = make_bundle(tmp_path, private, target_version="0.20.0", min_version="0.10.0")
    with pytest.raises(BundleError, match="Downgrade"):
        verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)


def test_unknown_format_version_is_rejected(tmp_path, keypair):
    private, public_b64 = keypair
    path = make_bundle(tmp_path, private, fmt=99)
    with pytest.raises(BundleError, match="Formatversion"):
        verify_bundle(path, extra_keys=public_b64, current_version=CURRENT)


# --- Kleinteile -------------------------------------------------------------


def test_parse_version_accepts_v_prefix_and_rejects_garbage():
    assert parse_version("v1.2.3") == (1, 2, 3)
    assert parse_version("1.2.3") == (1, 2, 3)
    for bad in ("1.2", "release-1.2.3", "", None):
        with pytest.raises(BundleError):
            parse_version(bad)


def test_trusted_keys_deduplicate_and_reject_malformed(keypair):
    _private, public_b64 = keypair
    assert len(trusted_public_keys(f"{public_b64},{public_b64}")) == 1
    with pytest.raises(BundleError, match="32 Bytes"):
        trusted_public_keys(base64.b64encode(b"zu-kurz").decode())
    with pytest.raises(BundleError, match="Base64"):
        trusted_public_keys("!!!kein-base64!!!")


def test_broken_archive_is_rejected(tmp_path, keypair):
    _private, public_b64 = keypair
    path = tmp_path / "kaputt.tar.gz"
    path.write_bytes(b"das ist kein tar-archiv")
    with pytest.raises(BundleError, match="nicht lesbar"):
        verify_bundle(str(path), extra_keys=public_b64, current_version=CURRENT)


# --- API -------------------------------------------------------------------


def test_verify_endpoint_accepts_and_audits(tmp_path, keypair, client, db, make_user, auth_headers, monkeypatch):
    from app.models import AuditEvent
    from app.services import update_bundle as svc

    private, public_b64 = keypair
    monkeypatch.setattr(svc, "RELEASE_PUBLIC_KEY", public_b64)
    path = make_bundle(tmp_path, private, target_version="99.0.0")

    admin = make_user(email="bundle-admin@example.com")
    with open(path, "rb") as handle:
        res = client.post(
            "/updates/bundle/verify",
            files={"file": ("bundle.tar.gz", handle, "application/gzip")},
            headers=auth_headers(admin),
        )

    assert res.status_code == 200
    body = res.json()
    assert body["valid"] is True
    assert body["info"]["target_version"] == "99.0.0"
    actions = [e.action for e in db.query(AuditEvent).all()]
    assert "update.bundle.verified" in actions


def test_verify_endpoint_reports_rejection_without_raising(tmp_path, keypair, client, db, make_user, auth_headers, monkeypatch):
    """Ein abgelehntes Bundle ist kein Serverfehler: 200 mit valid=false,
    damit die Oberflaeche den Grund anzeigen kann - und es steht im Audit-Log."""
    from app.models import AuditEvent
    from app.services import update_bundle as svc

    private, _ = keypair
    other = Ed25519PrivateKey.generate()
    monkeypatch.setattr(
        svc, "RELEASE_PUBLIC_KEY", base64.b64encode(other.public_key().public_bytes_raw()).decode()
    )
    path = make_bundle(tmp_path, private)

    admin = make_user(email="bundle-admin2@example.com")
    with open(path, "rb") as handle:
        res = client.post(
            "/updates/bundle/verify",
            files={"file": ("bundle.tar.gz", handle, "application/gzip")},
            headers=auth_headers(admin),
        )

    assert res.status_code == 200
    assert res.json()["valid"] is False
    assert res.json()["code"] == ERR_SIGNATURE
    assert "update.bundle.rejected" in [e.action for e in db.query(AuditEvent).all()]


def test_verify_endpoint_requires_admin(tmp_path, keypair, client, make_user, auth_headers):
    from app.models import UserRole

    private, _ = keypair
    path = make_bundle(tmp_path, private)
    viewer = make_user(email="kein-admin@example.com", role=UserRole.USER)
    with open(path, "rb") as handle:
        res = client.post(
            "/updates/bundle/verify",
            files={"file": ("bundle.tar.gz", handle, "application/gzip")},
            headers=auth_headers(viewer),
        )
    assert res.status_code == 403


# --- Ablehnungscodes -------------------------------------------------------


def test_rejection_codes_are_stable(tmp_path, keypair):
    """Der Code ist der Vertrag nach aussen - die Meldung bleibt im Log.

    Ohne diesen Test koennte eine umformulierte Meldung unbemerkt den Code
    mitziehen, und die Oberflaeche zeigte pltzlich den Fallbacktext.
    """
    private, public_b64 = keypair
    other = Ed25519PrivateKey.generate()

    def code_for(path, *, keys=None, current=CURRENT):
        with pytest.raises(BundleError) as excinfo:
            verify_bundle(path, extra_keys=public_b64 if keys is None else keys, current_version=current)
        return excinfo.value.code

    assert code_for(make_bundle(tmp_path, private), keys="") == ERR_NO_KEY
    assert code_for(make_bundle(tmp_path, other)) == ERR_SIGNATURE
    assert code_for(make_bundle(tmp_path, private, fmt=99)) == ERR_FORMAT
    assert code_for(make_bundle(tmp_path, private, target_version="0.50.0", min_version="0.40.0")) == ERR_MIN_VERSION
    assert code_for(make_bundle(tmp_path, private, target_version="0.20.0", min_version="0.10.0")) == ERR_DOWNGRADE
    assert (
        code_for(make_bundle(tmp_path, private, extra_members={"payload/extra.py": b"x\n"})) == ERR_CONTENT
    )
    assert (
        code_for(make_bundle(tmp_path, private, extra_members={"payload/../../etc/passwd": b"x\n"}))
        == ERR_UNSAFE
    )

    broken = tmp_path / "kaputt.tar.gz"
    broken.write_bytes(b"kein tar")
    assert code_for(str(broken)) == ERR_NOT_A_BUNDLE


def test_rejection_response_carries_no_exception_text(tmp_path, keypair, client, make_user, auth_headers, monkeypatch):
    """Die HTTP-Antwort enthaelt nur den Code - keine Dateinamen, keine
    Serverpfade, keinen Text fremder Ausnahmen (CodeQL py/stack-trace-exposure)."""
    from app.services import update_bundle as svc

    private, _ = keypair
    other = Ed25519PrivateKey.generate()
    monkeypatch.setattr(
        svc, "RELEASE_PUBLIC_KEY", base64.b64encode(other.public_key().public_bytes_raw()).decode()
    )
    path = make_bundle(tmp_path, private)

    admin = make_user(email="bundle-admin3@example.com")
    with open(path, "rb") as handle:
        res = client.post(
            "/updates/bundle/verify",
            files={"file": ("bundle.tar.gz", handle, "application/gzip")},
            headers=auth_headers(admin),
        )

    body = res.json()
    assert set(body) == {"valid", "code", "info"}
    assert body["code"] == ERR_SIGNATURE
    # Kein Freitext, kein Pfad, kein Dateiname irgendwo in der Antwort.
    assert "/tmp" not in res.text
    assert "Signatur" not in res.text
