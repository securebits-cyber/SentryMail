"""add user.is_primary (Hauptadmin, nicht löschbar)

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-07-07

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d3e4f5a6b7c8"
down_revision = "c2d3e4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Backfill: den zuerst erstellten Admin als Hauptadmin markieren, damit auch
    # bestehende Installationen einen geschützten Hauptadmin haben.
    op.execute(
        """
        UPDATE users SET is_primary = true
        WHERE id = (
            SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
        )
        """
    )


def downgrade() -> None:
    op.drop_column("users", "is_primary")
