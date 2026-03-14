"""expand avatar_url column to TEXT

Revision ID: expand_avatar_url_to_text
Revises: add_faixas
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "expand_avatar_url_to_text"
down_revision: Union[str, None] = "add_faixas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "avatar_url", type_=sa.Text())


def downgrade() -> None:
    op.alter_column("users", "avatar_url", type_=sa.String(length=2048))

