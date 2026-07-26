# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Hash-Verkettung des Audit-Logs (Welle 9.3)

Bestehende Eintraege werden in ihrer zeitlichen Reihenfolge eingekettet. Die
Kette beginnt damit beim ersten je aufgezeichneten Ereignis - sie belegt
allerdings nur, dass seit **dieser Migration** nichts mehr veraendert wurde.
Aelteres kann sie nicht rueckwirkend bezeugen, und sie behauptet es auch nicht.

Die kanonische Form ist hier bewusst **ausgeschrieben** statt aus
``app.services.audit_chain`` importiert: Eine Migration muss das Verhalten von
damals reproduzieren, auch wenn sich der Anwendungscode spaeter aendert.

Revision ID: f6a7b8c9d1e2
Revises: e5f6a7b8c9d1
Create Date: 2026-07-26 00:00:00.000000

"""
import hashlib
import json
from datetime import timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d1e2"
down_revision: Union[str, None] = "e5f6a7b8c9d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GENESIS_HASH = "0" * 64
CANONICAL_VERSION = 1


def _hash(row, seq: int, prev_hash: str) -> str:
    payload = {
        "v": CANONICAL_VERSION,
        "seq": seq,
        "created_at": row.created_at.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z",
        "actor_email": row.actor_email or "",
        "actor_name": row.actor_name or "",
        "category": row.category or "",
        "action": row.action or "",
        "description": row.description or "",
        "ip": row.ip or "",
        "prev_hash": prev_hash,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def upgrade() -> None:
    # Erst nullable anlegen, dann befuellen, dann festziehen - sonst scheitert
    # die Migration auf jeder Instanz, die schon Audit-Eintraege hat.
    op.add_column("audit_events", sa.Column("seq", sa.BigInteger(), nullable=True))
    op.add_column("audit_events", sa.Column("prev_hash", sa.String(length=64), nullable=True))
    op.add_column("audit_events", sa.Column("entry_hash", sa.String(length=64), nullable=True))
    op.add_column(
        "audit_events", sa.Column("content_purged_at", sa.DateTime(timezone=True), nullable=True)
    )

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, created_at, actor_email, actor_name, category, action, description, ip "
            "FROM audit_events ORDER BY created_at, id"
        )
    ).fetchall()

    prev_hash = GENESIS_HASH
    for seq, row in enumerate(rows, start=1):
        entry_hash = _hash(row, seq, prev_hash)
        conn.execute(
            sa.text(
                "UPDATE audit_events SET seq = :seq, prev_hash = :prev, entry_hash = :hash "
                "WHERE id = :id"
            ),
            {"seq": seq, "prev": prev_hash, "hash": entry_hash, "id": row.id},
        )
        prev_hash = entry_hash

    op.alter_column("audit_events", "seq", nullable=False)
    op.alter_column("audit_events", "prev_hash", nullable=False)
    op.alter_column("audit_events", "entry_hash", nullable=False)
    op.create_index("ix_audit_events_seq", "audit_events", ["seq"], unique=True)
    op.create_unique_constraint("uq_audit_events_entry_hash", "audit_events", ["entry_hash"])


def downgrade() -> None:
    op.drop_constraint("uq_audit_events_entry_hash", "audit_events", type_="unique")
    op.drop_index("ix_audit_events_seq", table_name="audit_events")
    op.drop_column("audit_events", "content_purged_at")
    op.drop_column("audit_events", "entry_hash")
    op.drop_column("audit_events", "prev_hash")
    op.drop_column("audit_events", "seq")
