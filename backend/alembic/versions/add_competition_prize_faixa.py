"""add faixa_id to competition prizes and update unique constraint

Revision ID: add_prize_faixa
Revises: add_stu_weight
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_prize_faixa"
down_revision: Union[str, None] = "add_stu_weight"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "competition_prizes",
        sa.Column(
            "faixa_id",
            sa.Integer(),
            sa.ForeignKey("faixas.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_comp_prizes_faixa_id",
        "competition_prizes",
        ["faixa_id"],
    )

    # Atualiza a unicidade para permitir premiações diferentes por faixa
    op.drop_constraint("uq_comp_prize_target_place", "competition_prizes", type_="unique")
    op.create_unique_constraint(
        "uq_comp_prize_target_place",
        "competition_prizes",
        ["competition_id", "kind", "age_division_id", "faixa_id", "gender", "modality", "place"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_comp_prize_target_place", "competition_prizes", type_="unique")
    op.create_unique_constraint(
        "uq_comp_prize_target_place",
        "competition_prizes",
        ["competition_id", "kind", "age_division_id", "gender", "modality", "place"],
    )

    op.drop_index("ix_comp_prizes_faixa_id", table_name="competition_prizes")
    op.drop_column("competition_prizes", "faixa_id")

