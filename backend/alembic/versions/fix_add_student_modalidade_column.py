"""fix: garante que coluna students.modalidade exista (idempotente)

Revision ID: fix_modalidade
Revises: add_student_modalidade
Create Date: 2026-03-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "fix_modalidade"
down_revision: Union[str, None] = "add_student_modalidade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adiciona a coluna apenas se não existir (corrige banco sem a coluna)
    op.execute(
        sa.text(
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS modalidade VARCHAR(64)"
        )
    )


def downgrade() -> None:
    op.drop_column("students", "modalidade")
