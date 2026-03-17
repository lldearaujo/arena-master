"""add check-in presence_confirmed

Revision ID: add_checkin_presence
Revises: add_mural_author_id
Create Date: 2026-03-16

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_checkin_presence"
down_revision: Union[str, None] = "add_mural_author_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "check_ins",
        sa.Column("presence_confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "check_ins",
        sa.Column(
            "presence_confirmed_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_check_ins_presence_confirmed_at",
        "check_ins",
        ["presence_confirmed_at"],
    )
    op.create_index(
        "ix_check_ins_presence_confirmed_by_user_id",
        "check_ins",
        ["presence_confirmed_by_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_check_ins_presence_confirmed_by_user_id", table_name="check_ins")
    op.drop_index("ix_check_ins_presence_confirmed_at", table_name="check_ins")
    op.drop_column("check_ins", "presence_confirmed_by_user_id")
    op.drop_column("check_ins", "presence_confirmed_at")
