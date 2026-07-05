# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""add oidc config

Revision ID: 2745dca9ec5f
Revises: 93f78de3023b
Create Date: 2026-07-04 18:21:29.096893

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '2745dca9ec5f'
down_revision: Union[str, None] = '93f78de3023b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "oidc_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("issuer", sa.String(512), nullable=False, server_default=""),
        sa.Column("client_id", sa.String(255), nullable=False, server_default=""),
        sa.Column("client_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("redirect_uri", sa.String(1024), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("oidc_config")
