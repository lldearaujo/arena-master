"""add competitions description column

Revision ID: add_comp_desc
Revises: add_stu_weight
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_comp_desc"
down_revision: Union[str, None] = "add_stu_weight"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("competitions", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("competitions", "description")

