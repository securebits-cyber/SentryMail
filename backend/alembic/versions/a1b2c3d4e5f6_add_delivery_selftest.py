# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zustell-Selbsttest gegen ein Kanarienpostfach (Welle 9.1)

Vor dem Kampagnenstart geht eine Probemail ueber denselben Weg wie die Kampagne
an ein eigenes Postfach. Ohne konfiguriertes Kanarienpostfach entfaellt der Test
kommentarlos - bestehende Installationen aendern ihr Verhalten durch dieses
Update also nicht.

Revision ID: a1b2c3d4e5f6
Revises: d0e1f2a3b4c5
Create Date: 2026-07-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "delivery_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("canary_address", sa.String(length=320), nullable=False, server_default=""),
        sa.Column("imap_host", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("imap_port", sa.Integer(), nullable=False, server_default="993"),
        sa.Column("imap_username", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("imap_password_encrypted", sa.Text(), nullable=True),
        sa.Column("imap_use_ssl", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("imap_mailbox", sa.String(length=255), nullable=False, server_default="INBOX"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Hoechstens eine Zeile (Singleton) - siehe app/utils/singleton.py.
    op.create_index(
        "uq_delivery_config_singleton", "delivery_config", [sa.text("(true)")], unique=True
    )

    op.create_table(
        "delivery_self_tests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("route", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("error", sa.String(length=512), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_delivery_self_tests_campaign_id", "delivery_self_tests", ["campaign_id"])
    op.create_index("ix_delivery_self_tests_token", "delivery_self_tests", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_delivery_self_tests_token", table_name="delivery_self_tests")
    op.drop_index("ix_delivery_self_tests_campaign_id", table_name="delivery_self_tests")
    op.drop_table("delivery_self_tests")
    op.drop_index("uq_delivery_config_singleton", table_name="delivery_config")
    op.drop_table("delivery_config")
