# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Datenschutzmodus, k-Anonymitaet und Rolle privacy_officer

Welle 2 (Datenschutz-/Mitbestimmungs-Modus): Der Modus schaltet die Sperre fuer
Einzelpersonen-Auswertungen und die k-Anonymitaet scharf; die neue Rolle
``privacy_officer`` traegt die Rollentrennung und spaeter die Vier-Augen-Freigabe.
Beide Flags sind Default AUS, damit ein Update das Verhalten bestehender
Instanzen nicht veraendert.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-25 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres erlaubt ALTER TYPE ... ADD VALUE nicht innerhalb der
    # Migrations-Transaktion - der autocommit_block schaltet sie dafuer ab.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'privacy_officer'")

    op.add_column(
        "privacy_config",
        sa.Column("privacy_mode_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "privacy_config",
        sa.Column("k_anonymity_threshold", sa.Integer(), nullable=False, server_default="5"),
    )
    op.create_check_constraint(
        "ck_privacy_config_k_min", "privacy_config", "k_anonymity_threshold >= 2"
    )


def downgrade() -> None:
    op.drop_constraint("ck_privacy_config_k_min", "privacy_config", type_="check")
    op.drop_column("privacy_config", "k_anonymity_threshold")
    op.drop_column("privacy_config", "privacy_mode_enabled")
    # Der Enum-Wert bleibt bestehen: Postgres kennt kein DROP VALUE. Konten mit
    # dieser Rolle muessen vor einem Downgrade umgestellt werden.
