# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""SQLAlchemy Engine/Session-Setup."""
import logging
from collections.abc import Generator
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Verzeichnis der Core-Alembic-Migrationen (…/backend/alembic).
_ALEMBIC_DIR = Path(__file__).resolve().parent.parent / "alembic"
# Stabiler Advisory-Lock-Schlüssel, damit nicht mehrere Worker/Instanzen
# gleichzeitig migrieren (ASCII "HSMIG").
_MIGRATION_LOCK_KEY = 0x48534D4947


def run_core_migrations() -> None:
    """Bringt das Core-Schema beim Start auf head (idempotent).

    Wird im App-Lifespan aufgerufen, damit Schema-Änderungen ohne manuellen
    Migrationsschritt greifen. Ein Postgres-Advisory-Lock serialisiert parallele
    Worker/Instanzen.
    """
    cfg = Config()
    cfg.set_main_option("script_location", str(_ALEMBIC_DIR))
    cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": _MIGRATION_LOCK_KEY})
        try:
            command.upgrade(cfg, "head")
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _MIGRATION_LOCK_KEY})
    logger.info("Core-Datenbankmigrationen auf head")


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
