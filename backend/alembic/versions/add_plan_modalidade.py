"""add modalidade to finance_plans

Associates subscription plans to a dojo modality; NULL = valid for any modality (legacy).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "add_plan_modalidade"
down_revision: Union[str, None] = "c7d4b2a9f6ee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns("finance_plans")]
    if "modalidade" not in cols:
        op.add_column(
            "finance_plans",
            sa.Column("modalidade", sa.String(length=128), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns("finance_plans")]
    if "modalidade" in cols:
        op.drop_column("finance_plans", "modalidade")
