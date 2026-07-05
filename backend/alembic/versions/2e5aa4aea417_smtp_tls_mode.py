# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""smtp tls mode

Revision ID: 2e5aa4aea417
Revises: 5714a734a300
Create Date: 2026-07-04 13:38:44.652405

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e5aa4aea417'
down_revision: Union[str, None] = '5714a734a300'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sending_profiles",
        sa.Column("tls_mode", sa.String(16), nullable=False, server_default="starttls"),
    )
    # Bestehende Boolean-Werte migrieren: true -> starttls (Port 587 ueblich), false -> none.
    op.execute("UPDATE sending_profiles SET tls_mode = 'none' WHERE use_tls = false")
    op.drop_column("sending_profiles", "use_tls")


def downgrade() -> None:
    op.add_column(
        "sending_profiles",
        sa.Column("use_tls", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.execute("UPDATE sending_profiles SET use_tls = false WHERE tls_mode = 'none'")
    op.drop_column("sending_profiles", "tls_mode")
