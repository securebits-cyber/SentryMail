"""add landing page logo_b64

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-07-07

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c2d3e4f5a6b7"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("landing_pages", sa.Column("logo_b64", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("landing_pages", "logo_b64")
