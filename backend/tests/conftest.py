# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Gemeinsame Test-Fixtures.

Isolationsstrategie: Die Tests laufen im backend-Container gegen dieselbe
Postgres-Instanz wie die App, aber in einer **eigenen Datenbank**
(``<db>_test``). Die produktive DB wird nie angefasst. Zwischen den Tests
werden alle Tabellen geleert (TRUNCATE), sodass jeder Test frisch startet.

Wichtig: Die Test-DATABASE_URL wird gesetzt, *bevor* irgendein ``app``-Modul
importiert wird - erst dann werden Engine/Settings darauf gebunden.
"""
import os

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

# --- Test-Datenbank aus der vorhandenen DATABASE_URL ableiten und anlegen ----
_BASE_URL = os.environ["DATABASE_URL"]
_url = make_url(_BASE_URL)
_TEST_DB = f"{_url.database}_test"
_TEST_URL = _url.set(database=_TEST_DB)

# Verbindung zur Wartungs-DB (Original), um die Test-DB anzulegen.
_admin_engine = create_engine(_url, isolation_level="AUTOCOMMIT")
with _admin_engine.connect() as _conn:
    _exists = _conn.execute(
        text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": _TEST_DB}
    ).scalar()
    if not _exists:
        _conn.execute(text(f'CREATE DATABASE "{_TEST_DB}"'))
_admin_engine.dispose()

# App ab hier auf die Test-DB zeigen lassen (vor jedem app-Import!).
os.environ["DATABASE_URL"] = _TEST_URL.render_as_string(hide_password=False)

from app.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app import models  # noqa: E402,F401  - registriert alle Tabellen auf Base.metadata
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import User, UserRole  # noqa: E402
from app.utils.passwords import hash_password  # noqa: E402
from app.utils.security import create_access_token  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema() -> None:
    """Legt das Schema in der Test-DB einmalig an."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    """Leert vor jedem Test alle Tabellen (frischer Zustand)."""
    tables = ", ".join(f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables))
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def db():
    """Direkte DB-Session fuer Service-/Unit-Tests."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    """FastAPI-TestClient. Ohne ``with``-Block, damit der Lifespan (Bootstrap-
    Admin, Lizenz-Loop) nicht laeuft - die App zeigt bereits auf die Test-DB."""
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture
def make_user(db):
    """Factory: legt einen User an und gibt ihn zurueck."""

    def _make(
        email: str = "admin@example.com",
        password: str | None = "correct horse battery staple",
        role: UserRole = UserRole.ADMIN,
        is_active: bool = True,
        full_name: str = "Test Admin",
    ) -> User:
        user = User(
            email=email,
            full_name=full_name,
            password_hash=hash_password(password) if password else None,
            role=role,
            is_active=is_active,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _make


@pytest.fixture
def auth_headers():
    """Factory: Bearer-Header mit Voll-Zugriffs-Token fuer einen User."""

    def _headers(user: User) -> dict[str, str]:
        token = create_access_token(subject=str(user.id))
        return {"Authorization": f"Bearer {token}"}

    return _headers
