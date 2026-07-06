# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""tracking_events um clientseitige Metadaten erweitern

Bildschirmaufloesung und Browser-Sprache stehen nur im Client zur Verfuegung und
werden per Landing-Page-Beacon (/track/client) am Klick-Event nachgetragen.

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-07-06
"""
import sqlalchemy as sa
from alembic import op

revision = "e3f4a5b6c7d8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tracking_events", sa.Column("screen_resolution", sa.String(length=16), nullable=True))
    op.add_column("tracking_events", sa.Column("client_language", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("tracking_events", "client_language")
    op.drop_column("tracking_events", "screen_resolution")
