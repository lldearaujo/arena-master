"""add mural post modalidades

Revision ID: add_mural_post_modalidades
Revises: add_user_mural_last_seen_at
Create Date: 2026-03-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "add_mural_post_modalidades"
down_revision: Union[str, None] = "add_user_mural_last_seen_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    cols = {c["name"] for c in insp.get_columns("mural_posts")}
    if "modalidades" not in cols:
        op.add_column(
            "mural_posts",
            sa.Column("modalidades", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )
    # Acelerador para contains em JSONB (GIN).
    # (idempotente; em alguns ambientes pode não existir extensão/permite)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_mural_posts_modalidades_gin ON mural_posts USING GIN (modalidades)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_mural_posts_modalidades_gin")
    op.drop_column("mural_posts", "modalidades")

