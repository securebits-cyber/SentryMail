# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Hash-Verkettung des Audit-Logs (Welle 9.3, Schritt A).

Der heikelste Block der Welle: Die Kette haengt an einem Pfad, den jeder
Request benutzt, und ein Serialisierungsfehler faellt erst beim Kunden auf -
wenn der Verifier anschlaegt, obwohl niemand etwas manipuliert hat.

Geprueft wird deshalb dreierlei: dass die kanonische Form stabil ist, dass die
Kette unter Last nicht gabelt, und dass jede Art von Manipulation gefunden wird.
"""
import itertools
import threading
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import AuditEvent
from app.services import audit_chain
from app.services.audit import record_audit


def _events(db):
    return db.query(AuditEvent).order_by(AuditEvent.seq).all()


# --- Kanonische Form --------------------------------------------------------


def test_canonical_form_is_byte_stable():
    """Der eigentliche Vertrag. Aendert sich diese Ausgabe, gilt jede bisher
    erzeugte Kette als gebrochen - ohne dass jemand etwas manipuliert haette."""
    raw = audit_chain.canonical_bytes(
        seq=1,
        created_at=datetime(2026, 7, 26, 12, 0, 0, 123456, tzinfo=timezone.utc),
        actor_email="marcel@example.de",
        actor_name="Marcel",
        category="system",
        action="settings.updated",
        description="Etwas geaendert",
        ip="203.0.113.10",
        prev_hash=audit_chain.GENESIS_HASH,
    )
    assert raw == (
        b'{"action":"settings.updated","actor_email":"marcel@example.de",'
        b'"actor_name":"Marcel","category":"system","created_at":"2026-07-26T12:00:00.123456Z",'
        b'"description":"Etwas geaendert","ip":"203.0.113.10",'
        b'"prev_hash":"' + audit_chain.GENESIS_HASH.encode() + b'","seq":1,"v":1}'
    )


def test_timezone_does_not_change_the_hash():
    """Derselbe Zeitpunkt in anderer Zone ist derselbe Zeitpunkt. Wuerde die
    Zone durchschlagen, haette eine Serverumstellung die Kette gebrochen."""
    utc = datetime(2026, 7, 26, 12, 0, 0, tzinfo=timezone.utc)
    other = utc.astimezone(timezone(timedelta(hours=5)))
    common = {
        "seq": 1, "actor_email": "a@b.de", "actor_name": "A", "category": "system",
        "action": "x", "description": "y", "ip": None, "prev_hash": audit_chain.GENESIS_HASH,
    }
    assert audit_chain.compute_hash(created_at=utc, **common) == audit_chain.compute_hash(
        created_at=other, **common
    )


def test_umlauts_hash_identically_regardless_of_escaping():
    """ensure_ascii=False plus UTF-8: Umlaute duerfen nicht davon abhaengen,
    wie die Python-Version JSON escapt."""
    raw = audit_chain.canonical_bytes(
        seq=1,
        created_at=datetime(2026, 7, 26, tzinfo=timezone.utc),
        actor_email="a@b.de",
        actor_name="Müller",
        category="system",
        action="x",
        description="Änderung an Grüßen",
        ip=None,
        prev_hash=audit_chain.GENESIS_HASH,
    )
    assert "Müller".encode() in raw
    assert b"\\u" not in raw


def test_none_and_empty_ip_are_the_same():
    common = {
        "seq": 1, "created_at": datetime(2026, 7, 26, tzinfo=timezone.utc), "actor_email": "a@b.de",
        "actor_name": "A", "category": "system", "action": "x", "description": "y",
        "prev_hash": audit_chain.GENESIS_HASH,
    }
    assert audit_chain.compute_hash(ip=None, **common) == audit_chain.compute_hash(ip="", **common)


def test_every_hashed_field_changes_the_hash():
    """Ein Feld, das nicht in den Hash eingeht, koennte unbemerkt geaendert
    werden. Dieser Test faengt ein versehentlich vergessenes Feld."""
    base = {
        "seq": 1,
        "created_at": datetime(2026, 7, 26, tzinfo=timezone.utc),
        "actor_email": "a@b.de",
        "actor_name": "A",
        "category": "system",
        "action": "x",
        "description": "y",
        "ip": "1.2.3.4",
        "prev_hash": audit_chain.GENESIS_HASH,
    }
    reference = audit_chain.compute_hash(**base)
    variants = {
        "seq": 2,
        "created_at": datetime(2026, 7, 27, tzinfo=timezone.utc),
        "actor_email": "anders@b.de",
        "actor_name": "B",
        "category": "auth",
        "action": "z",
        "description": "anders",
        "ip": "5.6.7.8",
        "prev_hash": "f" * 64,
    }
    for field, value in variants.items():
        assert audit_chain.compute_hash(**{**base, field: value}) != reference, field


# --- Anhaengen --------------------------------------------------------------


def test_first_entry_starts_at_genesis(db):
    record_audit(db, action="erster", description="x")
    events = _events(db)
    assert len(events) == 1
    assert events[0].seq == 1
    assert events[0].prev_hash == audit_chain.GENESIS_HASH


def test_entries_link_to_their_predecessor(db):
    for i in range(5):
        record_audit(db, action=f"schritt-{i}", description="x")
    events = _events(db)
    assert [e.seq for e in events] == [1, 2, 3, 4, 5]
    for previous, current in itertools.pairwise(events):
        assert current.prev_hash == previous.entry_hash
    assert audit_chain.verify_chain(events) == []


def test_deleting_a_user_does_not_break_the_chain(db, make_user):
    """actor_id ist ON DELETE SET NULL. Waere es Teil des Hashes, wuerde das
    Loeschen eines Kontos die Kette rueckwirkend zerreissen - der teuerste
    denkbare Fehler an dieser Stelle."""
    user = make_user(email="verschwindet@example.de")
    record_audit(db, action="etwas", description="x", actor=user)
    record_audit(db, action="danach", description="y")

    db.delete(user)
    db.commit()
    db.expire_all()

    events = _events(db)
    assert events[0].actor_id is None
    assert audit_chain.verify_chain(events) == []


# --- Nebenlaeufigkeit -------------------------------------------------------


def test_parallel_appends_do_not_fork_the_chain(db):
    """Ohne Sperre lesen zwei Anhaenger denselben Vorgaenger und erzeugen zwei
    Eintraege mit gleichem prev_hash. Der Verifier meldete dann einen Bruch,
    den niemand verursacht hat.

    Bewusst mit echten, parallelen Sessions - eine gemockte Sperre wuerde genau
    das nicht pruefen, worum es geht.
    """
    errors: list[Exception] = []

    def append(index: int) -> None:
        session = SessionLocal()
        try:
            record_audit(session, action=f"parallel-{index}", description="x")
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)
        finally:
            session.close()

    threads = [threading.Thread(target=append, args=(i,)) for i in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert not errors, errors
    db.expire_all()
    events = _events(db)
    assert len(events) == 8
    assert [e.seq for e in events] == list(range(1, 9))
    assert len({e.prev_hash for e in events}) == 8, "gegabelte Kette: prev_hash doppelt"
    assert audit_chain.verify_chain(events) == []


# --- Manipulationen finden --------------------------------------------------


def test_changed_content_is_detected(db):
    for i in range(3):
        record_audit(db, action=f"schritt-{i}", description="original")

    events = _events(db)
    events[1].description = "nachtraeglich geaendert"
    db.commit()
    db.expire_all()

    problems = audit_chain.verify_chain(_events(db))
    assert [p["code"] for p in problems] == ["content_altered"]
    assert problems[0]["seq"] == 2


def test_a_removed_entry_is_detected(db):
    for i in range(4):
        record_audit(db, action=f"schritt-{i}", description="x")

    events = _events(db)
    db.delete(events[1])
    db.commit()
    db.expire_all()

    codes = {p["code"] for p in audit_chain.verify_chain(_events(db))}
    assert "gap" in codes
    assert "broken_link" in codes


def test_a_swapped_entry_is_detected(db):
    """Zwei Eintraege zu vertauschen bricht die Verkettung, auch wenn beide
    fuer sich unveraendert sind."""
    for i in range(3):
        record_audit(db, action=f"schritt-{i}", description="x")

    events = _events(db)
    events[0].seq, events[1].seq = 99, 98  # zwischenparken, seq ist unique
    db.commit()
    events[0].seq, events[1].seq = 2, 1
    db.commit()
    db.expire_all()

    assert audit_chain.verify_chain(_events(db)) != []


def test_a_tombstone_keeps_the_chain_verifiable(db):
    """Welle 2 hat Vorrang: Geloescht wird der Inhalt, Hash und Verkettung
    bleiben. Sonst stuende die Aufbewahrungsfrist gegen die Nachweiskette."""
    for i in range(3):
        record_audit(db, action=f"schritt-{i}", description="personenbezogen")

    events = _events(db)
    events[1].description = ""
    events[1].actor_email = ""
    events[1].ip = None
    events[1].content_purged_at = datetime.now(timezone.utc)
    db.commit()
    db.expire_all()

    assert audit_chain.verify_chain(_events(db)) == []


def test_an_empty_chain_is_valid():
    assert audit_chain.verify_chain([]) == []


# --- Nicht brechen ----------------------------------------------------------


def test_a_failing_audit_never_breaks_the_actual_operation(db, monkeypatch):
    """Die Zusage aus dem Modul-Docstring gilt weiter - jetzt auch mit Kette."""

    def boom(*_a, **_k):
        raise RuntimeError("Kette kaputt")

    monkeypatch.setattr(audit_chain, "prepare", boom)
    record_audit(db, action="egal", description="x")  # darf nicht werfen
    assert _events(db) == []
