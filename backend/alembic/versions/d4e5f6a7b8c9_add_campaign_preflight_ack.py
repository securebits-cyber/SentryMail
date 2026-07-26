# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Bestaetigter Preflight je Kampagne (Welle 9.2)

Ohne Bestaetigung startet eine Kampagne nicht mehr. Bestandskampagnen haben
``NULL`` und muessen den Dialog einmal durchlaufen - das ist beabsichtigt: Der
Sinn des Preflights ist, dass jemand hingesehen hat.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("preflight_ack_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "campaigns",
        sa.Column(
            "preflight_ack_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("campaigns", "preflight_ack_by_id")
    op.drop_column("campaigns", "preflight_ack_at")
