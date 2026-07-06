# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""drop ldap_config (ausgelagert ins Business-Add-on)

Die LDAP-Anbindung ist ein Business-Feature und wurde aus dem Open-Core in das
private Business-Add-on-Paket verschoben. Der Core gibt die Tabellen-Ownership
ab; das Add-on legt ``ldap_config`` mit seiner eigenen Alembic-Kette neu an.

Revision ID: b8e1f3a9c2d4
Revises: e40ff1108a13
Create Date: 2026-07-06
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b8e1f3a9c2d4"
down_revision = "e40ff1108a13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("ldap_config")


def downgrade() -> None:
    # Nur fuer Rollback; im Normalbetrieb besitzt das Business-Add-on diese Tabelle.
    op.create_table(
        "ldap_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("host", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("port", sa.Integer(), nullable=False, server_default="389"),
        sa.Column("use_ssl", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("start_tls", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("bind_dn", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("bind_password_encrypted", sa.Text(), nullable=True),
        sa.Column("base_dn", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("user_filter", sa.String(length=512), nullable=False, server_default="(objectClass=person)"),
        sa.Column("attr_email", sa.String(length=64), nullable=False, server_default="mail"),
        sa.Column("attr_first_name", sa.String(length=64), nullable=False, server_default="givenName"),
        sa.Column("attr_last_name", sa.String(length=64), nullable=False, server_default="sn"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
