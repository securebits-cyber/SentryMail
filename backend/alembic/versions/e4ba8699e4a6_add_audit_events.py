"""add audit events

Revision ID: e4ba8699e4a6
Revises: 2865d325a41c
Create Date: 2026-07-05 10:25:28.127331

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e4ba8699e4a6'
down_revision: Union[str, None] = '2865d325a41c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("actor_email", sa.String(320), nullable=False, server_default=""),
        sa.Column("actor_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("category", sa.String(32), nullable=False, server_default="system"),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("description", sa.String(512), nullable=False, server_default=""),
        sa.Column("ip", sa.String(64), nullable=True),
    )
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_audit_events_created_at", table_name="audit_events")
    op.drop_table("audit_events")
