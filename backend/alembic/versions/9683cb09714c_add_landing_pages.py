"""add landing pages

Revision ID: 9683cb09714c
Revises: 4cce998e18d4
Create Date: 2026-07-04 16:48:36.884362

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9683cb09714c'
down_revision: Union[str, None] = '4cce998e18d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "landing_pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("html_content", sa.Text(), nullable=False),
        sa.Column("capture_credentials", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("capture_passwords", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("redirect_url", sa.String(1024), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("landing_pages")
