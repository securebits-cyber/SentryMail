# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Herkunft von Empfaengergruppen

Fundament fuer SCIM (Welle 4): Eine Gruppe gehoert entweder dem Dashboard
(``manual``) oder einem Identity Provider (``scim``). Extern verwaltete Gruppen
sind im Dashboard schreibgeschuetzt - schrieben beide dieselbe Gruppe,
ueberschriebe der naechste Sync die Handarbeit wortlos.

Bestandsgruppen bleiben ``manual``: per LDAP oder Entra befuellte Gruppen sind
einmalige Importe, keine dauerhaften Eigentuemer, und bleiben bearbeitbar.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-07-25 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recipient_groups",
        sa.Column("source", sa.String(16), nullable=False, server_default="manual"),
    )
    op.add_column(
        "recipient_groups", sa.Column("external_id", sa.String(255), nullable=True)
    )
    op.create_index(
        "ix_recipient_groups_external_id", "recipient_groups", ["external_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_recipient_groups_external_id", table_name="recipient_groups")
    op.drop_column("recipient_groups", "external_id")
    op.drop_column("recipient_groups", "source")
