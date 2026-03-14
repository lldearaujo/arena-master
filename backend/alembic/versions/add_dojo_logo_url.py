"""noop placeholder for dojo logo_url (already applied manually)

Revision ID: add_dojo_logo_url
Revises: add_mural_posts
Create Date: 2026-03-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_dojo_logo_url"
down_revision: Union[str, None] = "add_mural_posts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A coluna logo_url já existe no banco; esta migration é apenas um marcador.
    pass


def downgrade() -> None:
    # Não removemos logo_url automaticamente para evitar perda de dados.
    pass

