"""expand turmas day_of_week

Revision ID: 718c8f234c39
Revises: b1c2d3e4f5a6
Create Date: 2026-03-12 07:52:27.073642

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '718c8f234c39'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "turmas",
        "day_of_week",
        existing_type=sa.String(length=16),
        type_=sa.String(length=64),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "turmas",
        "day_of_week",
        existing_type=sa.String(length=64),
        type_=sa.String(length=16),
        existing_nullable=False,
    )
