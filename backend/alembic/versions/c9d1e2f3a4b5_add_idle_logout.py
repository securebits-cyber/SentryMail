# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Automatische Abmeldung nach Untaetigkeit

Bisher galt allein ``ACCESS_TOKEN_EXPIRE_MINUTES`` aus der .env - eine
**absolute** Laufzeit. Sie hat zwei unerfreuliche Seiten zugleich: Wer
durcharbeitet, fliegt mitten in der Arbeit raus; wer den Rechner stehen laesst,
bleibt bis zum Ablauf angemeldet.

Dieses Feld trennt beides. ``0`` (Vorgabe) heisst: alles wie bisher - ein
Update aendert das Verhalten bestehender Installationen nicht. Ab ``> 0`` wird
die Sitzung bei jeder Anfrage erneuert und laeuft N Minuten nach der letzten
ab.

Revision ID: c9d1e2f3a4b5
Revises: b8c9d1e2f3a4
Create Date: 2026-07-27 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9d1e2f3a4b5"
down_revision: Union[str, None] = "b8c9d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "security_config",
        sa.Column("idle_logout_minutes", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("security_config", "idle_logout_minutes")
