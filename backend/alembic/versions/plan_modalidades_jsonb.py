"""plan modalidades: JSON array replaces single modalidade column

Um plano pode restringir a várias modalidades; vazio/NULL = qualquer modalidade.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "plan_modalidades_jsonb"
down_revision: Union[str, None] = "add_plan_modalidade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("finance_plans")}

    if "modalidades" not in cols:
        op.add_column(
            "finance_plans",
            sa.Column("modalidades", JSONB, nullable=True),
        )

    if "modalidade" in cols:
        op.execute(
            sa.text("""
                UPDATE finance_plans
                SET modalidades = jsonb_build_array(trim(modalidade))
                WHERE modalidade IS NOT NULL AND length(trim(modalidade)) > 0
            """)
        )
        op.drop_column("finance_plans", "modalidade")


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("finance_plans")}

    if "modalidade" not in cols:
        op.add_column(
            "finance_plans",
            sa.Column("modalidade", sa.String(length=128), nullable=True),
        )

    if "modalidades" in cols:
        op.execute(
            sa.text("""
                UPDATE finance_plans
                SET modalidade = modalidades ->> 0
                WHERE modalidades IS NOT NULL
                  AND jsonb_typeof(modalidades) = 'array'
                  AND jsonb_array_length(modalidades) >= 1
            """)
        )
        op.drop_column("finance_plans", "modalidades")
