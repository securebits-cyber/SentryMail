"""add local login support

Revision ID: 6b4706742c5b
Revises: 9ec12d04c935
Create Date: 2026-07-04 08:11:34.923701

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '6b4706742c5b'
down_revision: Union[str, None] = '9ec12d04c935'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('password_hash', sa.String(length=255), nullable=True))
    op.alter_column('users', 'oidc_subject',
               existing_type=sa.VARCHAR(length=255),
               nullable=True)
    op.create_check_constraint(
        'ck_users_has_login_method',
        'users',
        'password_hash IS NOT NULL OR oidc_subject IS NOT NULL',
    )


def downgrade() -> None:
    op.drop_constraint('ck_users_has_login_method', 'users', type_='check')
    op.alter_column('users', 'oidc_subject',
               existing_type=sa.VARCHAR(length=255),
               nullable=False)
    op.drop_column('users', 'password_hash')
