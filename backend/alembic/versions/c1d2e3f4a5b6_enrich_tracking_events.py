# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""tracking_events um Kontext-Metadaten anreichern

Ergaenzt aus dem User-Agent abgeleitete Buckets (browser, os, device_type)
sowie aus Request-Headern/Query erfasste Felder (referrer, accept_language,
utm_source/medium/campaign). Alle Spalten sind nullable und rueckwaerts-
kompatibel; bestehende Events bleiben unveraendert.

Revision ID: c1d2e3f4a5b6
Revises: b8e1f3a9c2d4
Create Date: 2026-07-06
"""
import sqlalchemy as sa
from alembic import op

revision = "c1d2e3f4a5b6"
down_revision = "b8e1f3a9c2d4"
branch_labels = None
depends_on = None

_COLUMNS = [
    ("browser", sa.String(length=64)),
    ("os", sa.String(length=64)),
    ("device_type", sa.String(length=16)),
    ("referrer", sa.String(length=512)),
    ("accept_language", sa.String(length=64)),
    ("utm_source", sa.String(length=128)),
    ("utm_medium", sa.String(length=128)),
    ("utm_campaign", sa.String(length=128)),
]


def upgrade() -> None:
    for name, col_type in _COLUMNS:
        op.add_column("tracking_events", sa.Column(name, col_type, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(_COLUMNS):
        op.drop_column("tracking_events", name)
