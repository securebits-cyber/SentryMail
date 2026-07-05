# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""add sending profiles

Revision ID: cb119fce13ba
Revises: 6b4706742c5b
Create Date: 2026-07-04 13:14:02.580169

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'cb119fce13ba'
down_revision: Union[str, None] = '6b4706742c5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sending_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("host", sa.String(255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("username", sa.String(255), nullable=True),
        sa.Column("password_encrypted", sa.Text(), nullable=True),
        sa.Column("from_email", sa.String(320), nullable=False),
        sa.Column("from_name", sa.String(255), nullable=False),
        sa.Column("use_tls", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("ignore_cert_errors", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("sending_profiles")
