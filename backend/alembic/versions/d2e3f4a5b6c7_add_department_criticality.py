# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Abteilung + Kritikalitaet an Gruppen-Mitgliedern und Empfaengern

Ergaenzt department + criticality an group_members sowie einen denormalisierten
Schnappschuss (position, department, criticality) an recipients, damit
Abteilungsvergleich und Human-Risk-Kriterien je Kampagne ausgewertet werden
koennen. Alle Spalten nullable und rueckwaertskompatibel.

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-07-06
"""
import sqlalchemy as sa
from alembic import op

revision = "d2e3f4a5b6c7"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("group_members", sa.Column("department", sa.String(length=255), nullable=True))
    op.add_column("group_members", sa.Column("criticality", sa.String(length=16), nullable=True))
    op.add_column("recipients", sa.Column("position", sa.String(length=255), nullable=True))
    op.add_column("recipients", sa.Column("department", sa.String(length=255), nullable=True))
    op.add_column("recipients", sa.Column("criticality", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("recipients", "criticality")
    op.drop_column("recipients", "department")
    op.drop_column("recipients", "position")
    op.drop_column("group_members", "criticality")
    op.drop_column("group_members", "department")
