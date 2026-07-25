# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Aufbewahrungsfrist mit automatischer Anonymisierung

Welle 2: ``retention_days`` bleibt bewusst NULL - ohne ausdrueckliche
Entscheidung des Betreibers wird nichts geloescht. ``recipients.anonymized_at``
markiert erledigte Zeilen und macht wiederholte Laeufe idempotent.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-25 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("privacy_config", sa.Column("retention_days", sa.Integer(), nullable=True))
    op.add_column(
        "privacy_config",
        sa.Column("retention_last_run_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        "ck_privacy_config_retention_min",
        "privacy_config",
        "retention_days IS NULL OR retention_days >= 1",
    )
    op.add_column(
        "recipients", sa.Column("anonymized_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index("ix_recipients_anonymized_at", "recipients", ["anonymized_at"])


def downgrade() -> None:
    op.drop_index("ix_recipients_anonymized_at", table_name="recipients")
    op.drop_column("recipients", "anonymized_at")
    op.drop_constraint("ck_privacy_config_retention_min", "privacy_config", type_="check")
    op.drop_column("privacy_config", "retention_last_run_at")
    op.drop_column("privacy_config", "retention_days")
