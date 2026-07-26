# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zweitfreigabe fuer Kampagnen hoher Risikoklasse (Welle 9.2)

Vier-Augen-Prinzip wie bei der Datenschutz-Freigabe aus Welle 2. Der
CheckConstraint sichert, dass Antragsteller und Entscheider verschieden sind -
die Regel haengt nicht allein an der Anwendungslogik.

Revision ID: e5f6a7b8c9d1
Revises: d4e5f6a7b8c9
Create Date: 2026-07-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e5f6a7b8c9d1"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    status = postgresql.ENUM(
        "pending", "approved", "rejected", name="campaign_approval_status", create_type=False
    )
    status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "campaign_approvals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "requested_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("requested_by_email", sa.String(length=320), nullable=False, server_default=""),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", status, nullable=False, server_default="pending"),
        sa.Column(
            "decided_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("decided_by_email", sa.String(length=320), nullable=False, server_default=""),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "decided_by_id IS NULL OR decided_by_id <> requested_by_id",
            name="ck_campaign_approval_four_eyes",
        ),
    )
    op.create_index("ix_campaign_approvals_campaign_id", "campaign_approvals", ["campaign_id"])
    op.create_index("ix_campaign_approvals_created_at", "campaign_approvals", ["created_at"])


def downgrade() -> None:
    op.drop_table("campaign_approvals")
    postgresql.ENUM(name="campaign_approval_status").drop(op.get_bind(), checkfirst=True)
