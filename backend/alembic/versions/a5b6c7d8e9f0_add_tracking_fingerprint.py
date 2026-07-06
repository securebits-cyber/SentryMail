# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""tracking_events um Client-Fingerprint erweitern

Ein leichtgewichtiger Fingerprint (Hash aus stabilen Browser-Merkmalen) wird
per Landing-Page-Beacon (/track/client) am Klick-Event nachgetragen.

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-07-06
"""
import sqlalchemy as sa
from alembic import op

revision = "a5b6c7d8e9f0"
down_revision = "f4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tracking_events", sa.Column("fingerprint", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("tracking_events", "fingerprint")
