"""add mural author_name

Revision ID: add_mural_author_name
Revises: add_mural_posts
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_mural_author_name"
down_revision: Union[str, None] = "add_mural_posts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mural_posts",
        sa.Column("author_name", sa.String(length=255), nullable=False, server_default=""),
    )
    # remove default after backfilling existing rows
    op.alter_column("mural_posts", "author_name", server_default=None)


def downgrade() -> None:
    op.drop_column("mural_posts", "author_name")

