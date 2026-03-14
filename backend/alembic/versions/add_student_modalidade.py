"""add student modalidade (sport modality)

Revision ID: add_student_modalidade
Revises: add_user_name
Create Date: 2026-03-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_student_modalidade"
down_revision: Union[str, None] = "add_user_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "students",
        sa.Column("modalidade", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("students", "modalidade")
