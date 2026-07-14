# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Singleton-Configs: Duplikate bereinigen + Ein-Zeilen-Unique-Index

Parallele Requests konnten beim Erstanlegen der Config-Singletons Duplikate
erzeugen; first() ohne ORDER BY las dann nichtdeterministisch. Behalten wird
je Tabelle die zuletzt aktualisierte Zeile; der Unique-Index auf (true)
verhindert kuenftige Duplikate.

Revision ID: 21fc0d71ef15
Revises: 44165293d793
Create Date: 2026-07-13 21:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '21fc0d71ef15'
down_revision: Union[str, None] = '44165293d793'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SINGLETON_TABLES = ("security_config", "license_state", "smtp_config", "oidc_config")


def upgrade() -> None:
    for table in SINGLETON_TABLES:
        op.execute(
            f"""
            DELETE FROM {table}
            WHERE id NOT IN (
                SELECT id FROM {table}
                ORDER BY updated_at DESC NULLS LAST, id
                LIMIT 1
            )
            """
        )
        op.create_index(
            f"uq_{table}_singleton", table, [sa.text("(true)")], unique=True
        )


def downgrade() -> None:
    for table in SINGLETON_TABLES:
        op.drop_index(f"uq_{table}_singleton", table_name=table)
