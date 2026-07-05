# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""add markdown source

Revision ID: 0a3e424a6e29
Revises: f0ac95ac2b37
Create Date: 2026-07-05 13:27:42.539959

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0a3e424a6e29'
down_revision: Union[str, None] = 'f0ac95ac2b37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("templates", sa.Column("markdown_source", sa.Text(), nullable=True))
    op.add_column("landing_pages", sa.Column("markdown_source", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("landing_pages", "markdown_source")
    op.drop_column("templates", "markdown_source")
