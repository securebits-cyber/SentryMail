# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Vier-Augen-Freigabe fuer Einzelpersonen-Auswertungen

Welle 2: Ein Admin beantragt die befristete Aufhebung der Sperre, der
Datenschutzbeauftragte entscheidet. Dass Antragsteller und Entscheider
verschieden sind, sichert ein CheckConstraint - die Regel darf nicht allein an
der Anwendungslogik haengen.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-07-25 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_STATUS_NAME = "privacy_unlock_status"
_STATUS_VALUES = ("pending", "approved", "rejected", "revoked")
# Der Typ wird unten einmal explizit angelegt; die Spalte darf ihn dann nicht
# noch einmal erzeugen (``create_type=False``), sonst bricht CREATE TABLE mit
# "type already exists" ab.
_STATUS = postgresql.ENUM(*_STATUS_VALUES, name=_STATUS_NAME, create_type=False)


def upgrade() -> None:
    postgresql.ENUM(*_STATUS_VALUES, name=_STATUS_NAME).create(op.get_bind(), checkfirst=True)
    op.create_table(
        "privacy_unlock_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "requested_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("requested_by_email", sa.String(320), nullable=False, server_default=""),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("duration_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("status", _STATUS, nullable=False, server_default="pending"),
        sa.Column(
            "decided_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("decided_by_email", sa.String(320), nullable=False, server_default=""),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "decided_by_id IS NULL OR decided_by_id <> requested_by_id",
            name="ck_privacy_unlock_four_eyes",
        ),
    )
    op.create_index(
        "ix_privacy_unlock_requests_requested_by_id",
        "privacy_unlock_requests",
        ["requested_by_id"],
    )
    op.create_index(
        "ix_privacy_unlock_requests_created_at", "privacy_unlock_requests", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_privacy_unlock_requests_created_at", table_name="privacy_unlock_requests")
    op.drop_index(
        "ix_privacy_unlock_requests_requested_by_id", table_name="privacy_unlock_requests"
    )
    op.drop_table("privacy_unlock_requests")
    postgresql.ENUM(name=_STATUS_NAME).drop(op.get_bind(), checkfirst=True)
