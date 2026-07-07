"""add template logo_b64

Revision ID: b1c2d3e4f5a6
Revises: a5b6c7d8e9f0
Create Date: 2026-07-07

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "a5b6c7d8e9f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("templates", sa.Column("logo_b64", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("templates", "logo_b64")
