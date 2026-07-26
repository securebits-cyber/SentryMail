# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Blast-Radius-Preflight: Regeln, Sperrfenster, Risikoklasse (Welle 9.2)

Alle Vorgaben sind so gewaehlt, dass ein Update das Verhalten bestehender
Installationen nicht aendert: Ruhezeiten aus, Cooldown 30 Tage, Zweitfreigabe
beim Admin, jede vorhandene Vorlage in der Risikoklasse ``low``.

Die Ausschlusstabelle traegt bewusst **keine** Grund-Spalte: Ausgeschlossen wird
ausschliesslich ueber die Gruppenzugehoerigkeit.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "templates",
        sa.Column("risk_class", sa.String(length=16), nullable=False, server_default="low"),
    )
    op.create_check_constraint(
        "ck_templates_risk_class", "templates", "risk_class IN ('low', 'medium', 'high')"
    )

    op.create_table(
        "preflight_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("quiet_hours_start", sa.Time(), nullable=True),
        sa.Column("quiet_hours_end", sa.Time(), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"),
        sa.Column("cooldown_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("second_approval_role", sa.String(length=32), nullable=False, server_default="admin"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("cooldown_days >= 0", name="ck_preflight_cooldown_min"),
        sa.CheckConstraint(
            "second_approval_role IN ('admin', 'privacy_officer')", name="ck_preflight_approval_role"
        ),
    )
    op.create_index(
        "uq_preflight_config_singleton", "preflight_config", [sa.text("(true)")], unique=True
    )

    op.create_table(
        "blackout_windows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("ends_at > starts_at", name="ck_blackout_order"),
    )
    op.create_index("ix_blackout_windows_starts_at", "blackout_windows", ["starts_at"])

    op.create_table(
        "campaign_group_exclusions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recipient_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        # Bewusst keine Spalte fuer den Grund eines Ausschlusses.
    )
    op.create_index(
        "ix_campaign_group_exclusions_campaign_id", "campaign_group_exclusions", ["campaign_id"]
    )
    op.create_index(
        "ix_campaign_group_exclusions_group_id", "campaign_group_exclusions", ["group_id"]
    )
    op.create_index(
        "uq_campaign_group_exclusion",
        "campaign_group_exclusions",
        ["campaign_id", "group_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("campaign_group_exclusions")
    op.drop_index("ix_blackout_windows_starts_at", table_name="blackout_windows")
    op.drop_table("blackout_windows")
    op.drop_index("uq_preflight_config_singleton", table_name="preflight_config")
    op.drop_table("preflight_config")
    op.drop_constraint("ck_templates_risk_class", "templates", type_="check")
    op.drop_column("templates", "risk_class")
