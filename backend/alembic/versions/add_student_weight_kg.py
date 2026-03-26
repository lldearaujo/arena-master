"""add student weight_kg column

Revision ID: add_stu_weight
Revises: add_comp_awards
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_stu_weight"
down_revision: Union[str, None] = "add_comp_awards"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("students", sa.Column("weight_kg", sa.Float(), nullable=True))
    op.create_index("ix_students_weight_kg", "students", ["weight_kg"])


def downgrade() -> None:
    op.drop_index("ix_students_weight_kg", table_name="students")
    op.drop_column("students", "weight_kg")

