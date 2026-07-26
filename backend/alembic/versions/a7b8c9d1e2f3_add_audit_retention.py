# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Eigene Aufbewahrungsfrist fuer Audit-Inhalte (Welle 9.3)

Bewusst getrennt von der Frist fuer Kampagnendaten: Das Audit-Log ist der
Nachweis, den ein Kunde im Pruefungsfall braucht. Es zusammen mit den
Kampagnendaten stillschweigend mitzuloeschen waere eine boese Ueberraschung.

``NULL`` (Vorgabe) heisst: Audit-Inhalte bleiben. Ein Update aendert das
Verhalten bestehender Installationen also nicht.

Revision ID: a7b8c9d1e2f3
Revises: f6a7b8c9d1e2
Create Date: 2026-07-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7b8c9d1e2f3"
down_revision: Union[str, None] = "f6a7b8c9d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("privacy_config", sa.Column("audit_retention_days", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_privacy_config_audit_retention_min",
        "privacy_config",
        "audit_retention_days IS NULL OR audit_retention_days >= 1",
    )


def downgrade() -> None:
    op.drop_constraint("ck_privacy_config_audit_retention_min", "privacy_config", type_="check")
    op.drop_column("privacy_config", "audit_retention_days")
