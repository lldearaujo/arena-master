"""add user name

Revision ID: add_user_name
Revises: add_mural_author_name
Create Date: 2026-03-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_user_name"
down_revision: Union[str, tuple[str, ...], None] = ("add_mural_author_name", "add_dojo_logo_url")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("name", sa.String(length=255), nullable=True),
    )
    # Backfill name for alunos from students table
    op.execute(
        sa.text(
            "UPDATE users u SET name = s.name FROM students s "
            "WHERE s.user_id = u.id AND u.role = 'aluno'"
        )
    )


def downgrade() -> None:
    op.drop_column("users", "name")
