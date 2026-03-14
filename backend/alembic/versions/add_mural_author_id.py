"""add mural author_id

Revision ID: add_mural_author_id
Revises: add_mural_author_avatar
Create Date: 2026-03-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_mural_author_id"
down_revision: Union[str, None] = "add_mural_author_avatar"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mural_posts",
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_mural_posts_author_id", "mural_posts", ["author_id"])
    # Backfill: associa posts existentes ao usuário pelo nome no mesmo dojo
    op.execute(sa.text("""
        UPDATE mural_posts p SET author_id = (
            SELECT u.id FROM users u
            WHERE u.dojo_id = p.dojo_id AND u.name = p.author_name
            LIMIT 1
        )
        WHERE p.author_id IS NULL
    """))


def downgrade() -> None:
    op.drop_index("ix_mural_posts_author_id", table_name="mural_posts")
    op.drop_column("mural_posts", "author_id")
