"""add license_state

Revision ID: e40ff1108a13
Revises: 0a3e424a6e29
Create Date: 2026-07-05 15:54:38.045728

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e40ff1108a13'
down_revision: Union[str, None] = '0a3e424a6e29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "license_state",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("instance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("license_key_encrypted", sa.Text(), nullable=True),
        sa.Column("lease_jwt", sa.Text(), nullable=True),
        sa.Column("features", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False),
        sa.Column("customer", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("license_expires", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_status", sa.String(length=32), nullable=False, server_default="no_license"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("license_state")
