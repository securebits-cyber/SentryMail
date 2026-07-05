"""add 2fa and security config

Revision ID: 6526a7061644
Revises: e4ba8699e4a6
Create Date: 2026-07-05 10:37:30.475096

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '6526a7061644'
down_revision: Union[str, None] = 'e4ba8699e4a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("twofa_method", sa.String(16), nullable=True))
    op.add_column("users", sa.Column("totp_secret_encrypted", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("totp_pending_secret_encrypted", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("twofa_backup_codes", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("twofa_email_code_hash", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("twofa_email_code_expires", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "security_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("require_2fa", sa.String(16), nullable=False, server_default="off"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("security_config")
    op.drop_column("users", "twofa_email_code_expires")
    op.drop_column("users", "twofa_email_code_hash")
    op.drop_column("users", "twofa_backup_codes")
    op.drop_column("users", "totp_pending_secret_encrypted")
    op.drop_column("users", "totp_secret_encrypted")
    op.drop_column("users", "twofa_method")
