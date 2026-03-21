"""add turmas.modalidade

Revision ID: add_turma_modalidade
Revises: add_dojo_skills
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_turma_modalidade"
down_revision: Union[str, None] = "add_dojo_skills"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE turmas ADD COLUMN IF NOT EXISTS modalidade VARCHAR(64)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_turmas_modalidade ON turmas (modalidade)"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS ix_turmas_modalidade"))
    op.drop_column("turmas", "modalidade")
