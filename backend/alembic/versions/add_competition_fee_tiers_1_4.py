"""add competitions registration fee tiers 1..4

Revision ID: add_comp_fee_tiers
Revises: merge_comp_desc_prize
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_comp_fee_tiers"
down_revision: Union[str, None] = "merge_comp_desc_prize"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("competitions", sa.Column("registration_fee_amount_1", sa.Float(), nullable=True))
    op.add_column("competitions", sa.Column("registration_fee_amount_2", sa.Float(), nullable=True))
    op.add_column("competitions", sa.Column("registration_fee_amount_3", sa.Float(), nullable=True))
    op.add_column("competitions", sa.Column("registration_fee_amount_4", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("competitions", "registration_fee_amount_4")
    op.drop_column("competitions", "registration_fee_amount_3")
    op.drop_column("competitions", "registration_fee_amount_2")
    op.drop_column("competitions", "registration_fee_amount_1")

