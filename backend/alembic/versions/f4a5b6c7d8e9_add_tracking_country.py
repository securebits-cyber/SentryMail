# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""tracking_events um Laendercode (GeoIP) erweitern

Der Laendercode wird beim Erfassen des Events ueber eine optional
konfigurierte lokale MMDB-Datei aufgeloest (GEOIP_DB_PATH).

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-07-06
"""
import sqlalchemy as sa
from alembic import op

revision = "f4a5b6c7d8e9"
down_revision = "e3f4a5b6c7d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tracking_events", sa.Column("country", sa.String(length=2), nullable=True))


def downgrade() -> None:
    op.drop_column("tracking_events", "country")
