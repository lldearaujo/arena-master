"""add user avatar_url

Revision ID: add_avatar
Revises: b1c2d3e4f5a6
Create Date: 2025-03-12

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "add_avatar"
down_revision = "718c8f234c39"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("avatar_url", sa.String(length=2048), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
