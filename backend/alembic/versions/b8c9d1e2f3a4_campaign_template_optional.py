# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Vorlage einer Kampagne optional

Bis hierher setzte jede Kampagne eine Mail-Vorlage voraus. Fuer Kampagnen, die
nicht per Mail laufen, ist das falsch: Ein USB-Drop legt Datentraeger aus, es
gibt keinen Betreff, kein HTML und keinen Absender. Die Vorlage war dort ein
Pflichtfeld ohne Verwendung - man musste eine beliebige auswaehlen, damit das
Anlegen durchging.

Die Bedingung wandert damit vom Anlegen zum Versenden: Wer eine Mail-Kampagne
versendet, braucht eine Vorlage, und das prueft der Versandpfad. Das Anlegen
selbst muss es nicht mehr wissen - und muss damit auch nichts ueber Kanaele
wissen, die es im Core gar nicht gibt.

Rueckwaerts: Bestandsdaten haben durchweg eine Vorlage, das Zuruecknehmen ist
deshalb gefahrlos. Gibt es zum Zeitpunkt des Downgrades bereits Kampagnen ohne
Vorlage, schlaegt es fehl - bewusst, statt sie stillschweigend zu loeschen oder
ihnen eine fremde Vorlage unterzuschieben.

Revision ID: b8c9d1e2f3a4
Revises: a7b8c9d1e2f3
Create Date: 2026-07-27 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8c9d1e2f3a4"
down_revision: Union[str, None] = "a7b8c9d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "campaigns",
        "template_id",
        existing_type=sa.UUID(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "campaigns",
        "template_id",
        existing_type=sa.UUID(),
        nullable=False,
    )
