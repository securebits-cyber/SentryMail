# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Datenschutz-Policy (Singleton) mit Fingerprinting-Opt-in

Welle 2 (Datenschutz-/Mitbestimmungs-Modus): Client-Fingerprinting ist per
Default AUS und nur nach ausdruecklicher Admin-Bestaetigung aktivierbar. Die
Policy liegt als Singleton-Config-Zeile (ein Unique-Index auf (true)).

Revision ID: e5f6a7b8c9d0
Revises: 21fc0d71ef15
Create Date: 2026-07-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = '21fc0d71ef15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "privacy_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "fingerprinting_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "uq_privacy_config_singleton", "privacy_config", [sa.text("(true)")], unique=True
    )


def downgrade() -> None:
    op.drop_index("uq_privacy_config_singleton", table_name="privacy_config")
    op.drop_table("privacy_config")
