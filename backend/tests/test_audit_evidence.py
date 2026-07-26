# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Nachweispaket und eigenstaendiger Verifier (Welle 9.3, Schritt B).

Der wichtigste Test hier ist der Rundlauf: Ein von SentryMail erzeugtes Paket
muss vom **eigenstaendigen** Werkzeug akzeptiert werden. Zwei Implementierungen
derselben kanonischen Form driften sonst auseinander - und das faellt erst beim
Kunden auf, wenn der Pruefer eine einwandfreie Kette fuer gebrochen erklaert.
"""
import importlib.util
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.models import AuditEvent, UserRole
from app.services.audit import record_audit

#: Das Werkzeug liegt bewusst ausserhalb des Backends - es soll ohne die App
#: lauffaehig sein. Hier wird es als Datei geladen, nicht importiert.
VERIFY_PATH = Path(__file__).resolve().parents[2] / "tools" / "sentrymail-verify" / "verify.py"


@pytest.fixture(scope="module")
def verifier():
    spec = importlib.util.spec_from_file_location("sentrymail_verify", VERIFY_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def admin(make_user):
    return make_user(email="evi-admin@example.com")


def _package(client, admin, auth_headers) -> bytes:
    res = client.get("/audit-events/evidence-package", headers=auth_headers(admin))
    assert res.status_code == 200
    return res.content


def _run(verifier, data: bytes, tmp_path, name="paket.zip") -> int:
    path = tmp_path / name
    path.write_bytes(data)
    return verifier.main([str(path)])


# --- Das Werkzeug ist eigenstaendig -----------------------------------------


def test_verifier_uses_only_the_standard_library():
    """Ein Pruefer soll die Datei mitnehmen und ausfuehren koennen, ohne etwas
    zu installieren. Eine Fremdabhaengigkeit wuerde genau das kaputt machen."""
    import ast
    import sys

    tree = ast.parse(VERIFY_PATH.read_text(encoding="utf-8"))
    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            imported.add(node.module.split(".")[0])
    imported.discard("__future__")
    assert imported <= set(sys.stdlib_module_names), sorted(imported - set(sys.stdlib_module_names))


# --- Rundlauf ---------------------------------------------------------------


def test_a_real_package_passes_the_standalone_verifier(client, db, admin, auth_headers, tmp_path, verifier):
    """Der Kern des Blocks: Beide Implementierungen der kanonischen Form muessen
    byte-genau uebereinstimmen."""
    for i in range(5):
        record_audit(db, action=f"schritt-{i}", description=f"Änderung {i} mit Umlaut", ip="203.0.113.10")

    assert _run(verifier, _package(client, admin, auth_headers), tmp_path) == 0


def test_an_empty_chain_produces_a_valid_package(client, db, admin, auth_headers, tmp_path, verifier):
    db.query(AuditEvent).delete()
    db.commit()
    assert _run(verifier, _package(client, admin, auth_headers), tmp_path) == 0


def test_package_contains_the_expected_files(client, db, admin, auth_headers):
    record_audit(db, action="etwas", description="x")
    with zipfile.ZipFile(io.BytesIO(_package(client, admin, auth_headers))) as archive:
        assert set(archive.namelist()) == {"events.jsonl", "manifest.json", "README.md"}
        manifest = json.loads(archive.read("manifest.json"))
        assert manifest["algorithm"] == "sha256"
        assert manifest["head_seq"] == manifest["entries"]


# --- Manipulationen am Paket ------------------------------------------------


def _repack(data: bytes, *, events=None, manifest=None) -> bytes:
    with zipfile.ZipFile(io.BytesIO(data)) as src:
        parts = {name: src.read(name) for name in src.namelist()}
    if events is not None:
        parts["events.jsonl"] = events.encode("utf-8")
    if manifest is not None:
        parts["manifest.json"] = json.dumps(manifest).encode("utf-8")
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as dst:
        for name, payload in parts.items():
            dst.writestr(name, payload)
    return out.getvalue()


def test_edited_content_is_detected(client, db, admin, auth_headers, tmp_path, verifier):
    for i in range(3):
        record_audit(db, action=f"schritt-{i}", description="original")
    data = _package(client, admin, auth_headers)

    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        lines = archive.read("events.jsonl").decode().splitlines()
    entry = json.loads(lines[1])
    entry["description"] = "nachtraeglich geschoent"
    lines[1] = json.dumps(entry, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

    assert _run(verifier, _repack(data, events="\n".join(lines) + "\n"), tmp_path) == 1


def test_a_removed_entry_is_detected(client, db, admin, auth_headers, tmp_path, verifier):
    for i in range(4):
        record_audit(db, action=f"schritt-{i}", description="x")
    data = _package(client, admin, auth_headers)

    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        lines = archive.read("events.jsonl").decode().splitlines()
    del lines[1]

    assert _run(verifier, _repack(data, events="\n".join(lines) + "\n"), tmp_path) == 1


def test_a_manipulated_head_in_the_manifest_is_detected(client, db, admin, auth_headers, tmp_path, verifier):
    record_audit(db, action="etwas", description="x")
    data = _package(client, admin, auth_headers)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        manifest = json.loads(archive.read("manifest.json"))
    manifest["head_hash"] = "f" * 64

    assert _run(verifier, _repack(data, manifest=manifest), tmp_path) == 1


def test_an_unknown_format_is_refused_not_declared_broken(client, db, admin, auth_headers, tmp_path, verifier):
    """Ein neueres Paket darf nicht als gebrochen gelten - eine falsche
    Zusicherung waere schlimmer als keine."""
    record_audit(db, action="etwas", description="x")
    data = _package(client, admin, auth_headers)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        manifest = json.loads(archive.read("manifest.json"))
    manifest["format"] = 99

    assert _run(verifier, _repack(data, manifest=manifest), tmp_path) == 2


def test_a_broken_zip_is_refused(tmp_path, verifier):
    path = tmp_path / "kaputt.zip"
    path.write_bytes(b"kein zip")
    assert verifier.main([str(path)]) == 2


def test_tombstones_pass_verification(client, db, admin, auth_headers, tmp_path, verifier):
    """Welle 2 hat Vorrang vor der Kette: Der Inhalt geht, die Verkettung bleibt."""
    for i in range(3):
        record_audit(db, action=f"schritt-{i}", description="personenbezogen")
    event = db.query(AuditEvent).order_by(AuditEvent.seq).all()[1]
    event.description = ""
    event.actor_email = ""
    event.ip = None
    event.content_purged_at = datetime.now(timezone.utc)
    db.commit()

    assert _run(verifier, _package(client, admin, auth_headers), tmp_path) == 0


# --- Zugriff und Statusendpunkt ---------------------------------------------


def test_chain_status_reports_intact(client, db, admin, auth_headers):
    for i in range(3):
        record_audit(db, action=f"schritt-{i}", description="x")
    body = client.get("/audit-events/chain", headers=auth_headers(admin)).json()
    assert body["intact"] is True
    assert body["entries"] == 3
    assert body["head_seq"] == 3


def test_chain_status_reports_a_break(client, db, admin, auth_headers):
    for i in range(3):
        record_audit(db, action=f"schritt-{i}", description="x")
    event = db.query(AuditEvent).order_by(AuditEvent.seq).all()[1]
    event.description = "geaendert"
    db.commit()

    body = client.get("/audit-events/chain", headers=auth_headers(admin)).json()
    assert body["intact"] is False
    assert body["problems"][0]["code"] == "content_altered"


def test_the_privacy_officer_may_export(client, db, make_user, auth_headers):
    """Seine Kontrollrolle ist ohne unabhaengig pruefbaren Nachweis wertlos."""
    officer = make_user(email="evi-officer@example.com", role=UserRole.PRIVACY_OFFICER)
    record_audit(db, action="etwas", description="x")
    res = client.get("/audit-events/evidence-package", headers=auth_headers(officer))
    assert res.status_code == 200


def test_a_plain_user_may_not_export(client, make_user, auth_headers):
    user = make_user(email="evi-plain@example.com", role=UserRole.USER)
    res = client.get("/audit-events/evidence-package", headers=auth_headers(user))
    assert res.status_code == 403


# --- Konfliktregel: Loeschpflicht vor Nachweiskette -------------------------


def test_preview_never_purges_audit_content(db):
    """preview() ist ausdruecklich 'veraendert nichts'. Der Betreiber schaut
    dort hin, *bevor* er eine Frist setzt - ein Loeschvorgang an dieser Stelle
    waere die schlimmste denkbare Ueberraschung."""
    from app.models import PrivacyConfig
    from app.services import retention
    from app.utils.singleton import get_or_create_singleton

    record_audit(db, action="alt", description="personenbezogen")
    config = get_or_create_singleton(db, PrivacyConfig)
    config.audit_retention_days = 1
    db.commit()

    event = db.query(AuditEvent).one()
    event.created_at = datetime.now(timezone.utc) - __import__("datetime").timedelta(days=10)
    db.commit()

    retention.preview(db)
    db.expire_all()
    assert db.query(AuditEvent).one().content_purged_at is None
    assert db.query(AuditEvent).one().description == "personenbezogen"


def test_purge_turns_old_entries_into_tombstones(db):
    """Beweisbar bleibt, *dass* und *wann* etwas geschah - ohne die Inhalte."""
    from datetime import timedelta

    from app.models import PrivacyConfig
    from app.services import audit_chain as chain
    from app.services import retention
    from app.utils.singleton import get_or_create_singleton

    for i in range(3):
        record_audit(db, action=f"schritt-{i}", description="personenbezogen", ip="203.0.113.10")

    config = get_or_create_singleton(db, PrivacyConfig)
    config.audit_retention_days = 30
    db.commit()

    old = db.query(AuditEvent).order_by(AuditEvent.seq).first()
    old.created_at = datetime.now(timezone.utc) - timedelta(days=60)
    db.commit()

    retention.purge_expired(db)
    db.expire_all()

    events = db.query(AuditEvent).order_by(AuditEvent.seq).all()
    purged = events[0]
    assert purged.content_purged_at is not None
    assert purged.description == "" and purged.ip is None
    # Der Nachweis bleibt: Position, Zeitpunkt und Verkettung stehen.
    assert purged.seq == 1 and purged.entry_hash and purged.created_at is not None
    # Und die Kette ist weiterhin lueckenlos pruefbar.
    assert chain.verify_chain(events) == []


def test_purge_is_idempotent(db):
    from datetime import timedelta

    from app.models import PrivacyConfig
    from app.services import audit_chain as chain
    from app.utils.singleton import get_or_create_singleton

    record_audit(db, action="alt", description="x")
    get_or_create_singleton(db, PrivacyConfig)
    event = db.query(AuditEvent).one()
    event.created_at = datetime.now(timezone.utc) - timedelta(days=60)
    db.commit()

    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    assert chain.purge_content(db, cutoff) == 1
    db.commit()
    assert chain.purge_content(db, cutoff) == 0


def test_without_an_audit_retention_nothing_is_purged(db):
    """Vorgabe ist NULL: Ein Update darf das Audit-Log bestehender
    Installationen nicht anfassen."""
    from datetime import timedelta

    from app.services import retention

    record_audit(db, action="alt", description="bleibt")
    event = db.query(AuditEvent).one()
    event.created_at = datetime.now(timezone.utc) - timedelta(days=3650)
    db.commit()

    retention.purge_expired(db)
    db.expire_all()
    assert db.query(AuditEvent).first().description == "bleibt"
