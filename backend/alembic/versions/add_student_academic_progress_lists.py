"""add student academic progress list columns (JSON text)

Revision ID: add_stu_acad_prog
Revises: add_mural_likes_and_comments
Create Date: 2026-03-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_stu_acad_prog"
down_revision: Union[str, None] = "add_mural_likes_and_comments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "students",
        sa.Column("academic_mastered_techniques", sa.Text(), nullable=True),
    )
    op.add_column(
        "students",
        sa.Column("academic_next_objectives", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("students", "academic_next_objectives")
    op.drop_column("students", "academic_mastered_techniques")
