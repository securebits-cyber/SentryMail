# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Kennzeichen fuer Leitungsorgane

Grundlage des gesonderten Nachweises der Schulungspflicht der Leitungsorgane
nach Paragraf 38 BSIG (Welle 5, Compliance-Modul). Bewusst ein eigenes Feld und
keine Auswertung der Funktionsbezeichnung: ein Tippfehler in "Geschaeftsfuehrung"
duerfte niemanden aus einem gesetzlich geforderten Nachweis fallen lassen.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-07-25 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0e1f2a3b4c5'
down_revision: Union[str, None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("group_members", "recipients"):
        op.add_column(
            table,
            sa.Column("is_management", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    for table in ("recipients", "group_members"):
        op.drop_column(table, "is_management")
