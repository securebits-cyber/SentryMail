# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Zustellergebnis je Empfaenger (Welle 9.1, Diagnose)

Bisher gab der Versand nur Zaehler zurueck; ein Fehlschlag hinterliess nichts
als eine Zahl. Fuer die Diagnose "Warum kam die Mail nicht an" braucht es den
SMTP-Statuscode je Empfaenger - er unterscheidet die voruebergehende Ablehnung
(4xx, typisch Greylisting) von der dauerhaften (5xx).

Alle Spalten sind nullable: Bestandsdaten bleiben unangetastet, ``NULL`` heisst
schlicht "vor dieser Version versendet".

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-26 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recipients", sa.Column("delivery_status", sa.String(length=16), nullable=True))
    op.add_column("recipients", sa.Column("delivery_code", sa.Integer(), nullable=True))
    op.add_column("recipients", sa.Column("delivery_error", sa.String(length=512), nullable=True))
    op.add_column(
        "recipients", sa.Column("delivery_checked_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("recipients", "delivery_checked_at")
    op.drop_column("recipients", "delivery_error")
    op.drop_column("recipients", "delivery_code")
    op.drop_column("recipients", "delivery_status")
