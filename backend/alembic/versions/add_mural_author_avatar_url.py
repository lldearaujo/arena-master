"""add mural author_avatar_url

Revision ID: add_mural_author_avatar
Revises: fix_modalidade
Create Date: 2026-03-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_mural_author_avatar"
down_revision: Union[str, None] = "fix_modalidade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mural_posts",
        sa.Column("author_avatar_url", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mural_posts", "author_avatar_url")
