"""add dojo localidade and contato

Revision ID: b1c2d3e4f5a6
Revises: dacac0583529
Create Date: 2026-03-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "dacac0583529"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dojos", sa.Column("localidade", sa.String(length=255), nullable=True))
    op.add_column("dojos", sa.Column("contato", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("dojos", "contato")
    op.drop_column("dojos", "localidade")
