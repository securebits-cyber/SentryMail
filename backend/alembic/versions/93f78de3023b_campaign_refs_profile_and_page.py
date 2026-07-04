"""campaign refs profile and page

Revision ID: 93f78de3023b
Revises: 9683cb09714c
Create Date: 2026-07-04 16:56:01.952359

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '93f78de3023b'
down_revision: Union[str, None] = '9683cb09714c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("sending_profile_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("campaigns", sa.Column("landing_page_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_campaigns_sending_profile", "campaigns", "sending_profiles", ["sending_profile_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_campaigns_landing_page", "campaigns", "landing_pages", ["landing_page_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("fk_campaigns_landing_page", "campaigns", type_="foreignkey")
    op.drop_constraint("fk_campaigns_sending_profile", "campaigns", type_="foreignkey")
    op.drop_column("campaigns", "landing_page_id")
    op.drop_column("campaigns", "sending_profile_id")
