"""add mural comments and likes

Revision ID: add_mural_likes_and_comments
Revises: merge_prizes
Create Date: 2026-03-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "add_mural_likes_and_comments"
down_revision: Union[str, None] = "merge_prizes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # Em dev pode existir via `create_all`; torne a migração idempotente.
    if not insp.has_table("mural_comments"):
        op.create_table(
            "mural_comments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "dojo_id",
                sa.Integer(),
                sa.ForeignKey("dojos.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "post_id",
                sa.Integer(),
                sa.ForeignKey("mural_posts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "author_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
    op.execute("CREATE INDEX IF NOT EXISTS ix_mural_comments_id ON mural_comments (id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mural_comments_dojo_id ON mural_comments (dojo_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mural_comments_post_id ON mural_comments (post_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mural_comments_author_id ON mural_comments (author_id)"
    )

    if not insp.has_table("mural_post_likes"):
        op.create_table(
            "mural_post_likes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "post_id",
                sa.Integer(),
                sa.ForeignKey("mural_posts.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint(
                "post_id", "user_id", name="uq_mural_post_likes_post_user"
            ),
        )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mural_post_likes_post_id ON mural_post_likes (post_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mural_post_likes_user_id ON mural_post_likes (user_id)"
    )

    if not insp.has_table("mural_comment_likes"):
        op.create_table(
            "mural_comment_likes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "comment_id",
                sa.Integer(),
                sa.ForeignKey("mural_comments.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint(
                "comment_id", "user_id", name="uq_mural_comment_likes_comment_user"
            ),
        )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mural_comment_likes_comment_id ON mural_comment_likes (comment_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mural_comment_likes_user_id ON mural_comment_likes (user_id)"
    )


def downgrade() -> None:
    op.drop_index("ix_mural_comment_likes_user_id", table_name="mural_comment_likes")
    op.drop_index(
        "ix_mural_comment_likes_comment_id", table_name="mural_comment_likes"
    )
    op.drop_table("mural_comment_likes")

    op.drop_index("ix_mural_post_likes_user_id", table_name="mural_post_likes")
    op.drop_index("ix_mural_post_likes_post_id", table_name="mural_post_likes")
    op.drop_table("mural_post_likes")

    op.drop_index("ix_mural_comments_author_id", table_name="mural_comments")
    op.drop_index("ix_mural_comments_post_id", table_name="mural_comments")
    op.drop_index("ix_mural_comments_dojo_id", table_name="mural_comments")
    op.drop_index("ix_mural_comments_id", table_name="mural_comments")
    op.drop_table("mural_comments")

