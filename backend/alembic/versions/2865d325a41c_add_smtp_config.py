# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""add smtp config

Revision ID: 2865d325a41c
Revises: a20b63dc8f13
Create Date: 2026-07-05 05:57:04.705591

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '2865d325a41c'
down_revision: Union[str, None] = 'a20b63dc8f13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "smtp_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("host", sa.String(255), nullable=False, server_default=""),
        sa.Column("port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("username", sa.String(255), nullable=False, server_default=""),
        sa.Column("password_encrypted", sa.Text(), nullable=True),
        sa.Column("from_email", sa.String(255), nullable=False, server_default=""),
        sa.Column("from_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("tls_mode", sa.String(16), nullable=False, server_default="starttls"),
        sa.Column("verify_ssl", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("smtp_config")
