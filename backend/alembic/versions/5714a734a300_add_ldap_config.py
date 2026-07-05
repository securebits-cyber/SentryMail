# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""add ldap config

Revision ID: 5714a734a300
Revises: cb119fce13ba
Create Date: 2026-07-04 13:28:53.444235

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '5714a734a300'
down_revision: Union[str, None] = 'cb119fce13ba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ldap_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("host", sa.String(255), nullable=False, server_default=""),
        sa.Column("port", sa.Integer(), nullable=False, server_default="389"),
        sa.Column("use_ssl", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("start_tls", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("bind_dn", sa.String(512), nullable=False, server_default=""),
        sa.Column("bind_password_encrypted", sa.Text(), nullable=True),
        sa.Column("base_dn", sa.String(512), nullable=False, server_default=""),
        sa.Column("user_filter", sa.String(512), nullable=False, server_default="(objectClass=person)"),
        sa.Column("attr_email", sa.String(64), nullable=False, server_default="mail"),
        sa.Column("attr_first_name", sa.String(64), nullable=False, server_default="givenName"),
        sa.Column("attr_last_name", sa.String(64), nullable=False, server_default="sn"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ldap_config")
