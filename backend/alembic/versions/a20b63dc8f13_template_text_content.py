# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""template text content

Revision ID: a20b63dc8f13
Revises: 2745dca9ec5f
Create Date: 2026-07-04 18:30:39.517975

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a20b63dc8f13'
down_revision: Union[str, None] = '2745dca9ec5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("templates", sa.Column("text_content", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("templates", "text_content")
