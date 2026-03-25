"""dojo_modalidades.skills_labels (5 habilidades por modalidade)

Revision ID: modalidade_skills_labels
Revises: dojo_mod_grad
"""

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "modalidade_skills_labels"
down_revision: Union[str, None] = "dojo_mod_grad"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("dojo_modalidades")}
    if "skills_labels" not in cols:
        op.add_column("dojo_modalidades", sa.Column("skills_labels", JSONB, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("dojo_modalidades")}
    if "skills_labels" in cols:
        op.drop_column("dojo_modalidades", "skills_labels")
