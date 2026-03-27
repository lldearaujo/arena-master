"""add user mural last seen at

Revision ID: add_user_mural_last_seen_at
Revises: add_mural_likes_and_comments
Create Date: 2026-03-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "add_user_mural_last_seen_at"
down_revision: Union[str, None] = "add_mural_likes_and_comments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    cols = {c["name"] for c in insp.get_columns("users")}
    if "mural_last_seen_at" not in cols:
        op.add_column(
            "users",
            sa.Column("mural_last_seen_at", sa.DateTime(timezone=True), nullable=True),
        )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_mural_last_seen_at ON users (mural_last_seen_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_users_mural_last_seen_at")
    op.drop_column("users", "mural_last_seen_at")

