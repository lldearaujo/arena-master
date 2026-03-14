"""add mural posts table

Revision ID: add_mural_posts
Revises: expand_avatar_url_to_text
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_mural_posts"
down_revision: Union[str, None] = "expand_avatar_url_to_text"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mural_posts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("dojo_id", sa.Integer(), sa.ForeignKey("dojos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_mural_posts_id", "mural_posts", ["id"])
    op.create_index("ix_mural_posts_dojo_id", "mural_posts", ["dojo_id"])
    op.create_index("ix_mural_posts_pinned", "mural_posts", ["pinned"])


def downgrade() -> None:
    op.drop_index("ix_mural_posts_pinned", table_name="mural_posts")
    op.drop_index("ix_mural_posts_dojo_id", table_name="mural_posts")
    op.drop_index("ix_mural_posts_id", table_name="mural_posts")
    op.drop_table("mural_posts")

