"""add student master_notes daily

Revision ID: 9b8a4c2d1f10
Revises: faixas_modalidade_id
Create Date: 2026-03-25
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9b8a4c2d1f10"
down_revision = "faixas_modalidade_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("students", sa.Column("master_notes", sa.Text(), nullable=True))
    op.add_column("students", sa.Column("master_notes_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("students", "master_notes_date")
    op.drop_column("students", "master_notes")

