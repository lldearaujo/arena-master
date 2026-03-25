"""dojo_modalidades: has_graduation_system

Revision ID: dojo_mod_grad
Revises: plan_modalidades_jsonb
Create Date: 2025-03-24

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "dojo_mod_grad"
down_revision: Union[str, None] = "plan_modalidades_jsonb"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("dojo_modalidades")}
    if "has_graduation_system" in cols:
        return
    op.add_column(
        "dojo_modalidades",
        sa.Column(
            "has_graduation_system",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.alter_column(
        "dojo_modalidades",
        "has_graduation_system",
        server_default=None,
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("dojo_modalidades")}
    if "has_graduation_system" not in cols:
        return
    op.drop_column("dojo_modalidades", "has_graduation_system")
