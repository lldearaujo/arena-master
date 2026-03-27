"""allow multiple registrations per student (kind/modality) and store fee

Revision ID: add_reg_multi_kind
Revises: add_comp_fee_tiers
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_reg_multi_kind"
down_revision: Union[str, None] = "add_comp_fee_tiers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns (nullable first for backfill)
    op.add_column("competition_registrations", sa.Column("kind", sa.String(length=16), nullable=True))
    op.add_column("competition_registrations", sa.Column("modality", sa.String(length=8), nullable=True))
    op.add_column("competition_registrations", sa.Column("faixa_id", sa.Integer(), nullable=True))
    op.add_column("competition_registrations", sa.Column("registration_fee_amount", sa.Float(), nullable=True))

    # Make age_division_id and weight_class_id nullable to support absolute registrations
    op.alter_column("competition_registrations", "age_division_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("competition_registrations", "weight_class_id", existing_type=sa.Integer(), nullable=True)

    # Backfill kind/modality for existing rows
    op.execute("UPDATE competition_registrations SET kind = 'category' WHERE kind IS NULL")
    # Fill modality from weight class when possible; fallback to 'gi'
    op.execute(
        """
        UPDATE competition_registrations r
        SET modality = COALESCE(w.modality, 'gi')
        FROM competition_weight_classes w
        WHERE r.weight_class_id = w.id AND r.modality IS NULL
        """
    )
    op.execute("UPDATE competition_registrations SET modality = 'gi' WHERE modality IS NULL")

    # Add indexes
    op.create_index("ix_comp_reg_kind", "competition_registrations", ["kind"])
    op.create_index("ix_comp_reg_modality", "competition_registrations", ["modality"])
    op.create_index("ix_comp_reg_faixa_id", "competition_registrations", ["faixa_id"])

    # Replace unique constraint
    op.drop_constraint("uq_comp_student", "competition_registrations", type_="unique")
    op.create_unique_constraint(
        "uq_comp_student_kind_modality",
        "competition_registrations",
        ["competition_id", "student_id", "kind", "modality"],
    )

    # Make new columns non-null
    op.alter_column("competition_registrations", "kind", existing_type=sa.String(length=16), nullable=False)
    op.alter_column("competition_registrations", "modality", existing_type=sa.String(length=8), nullable=False)


def downgrade() -> None:
    op.drop_constraint("uq_comp_student_kind_modality", "competition_registrations", type_="unique")
    op.create_unique_constraint("uq_comp_student", "competition_registrations", ["competition_id", "student_id"])

    op.drop_index("ix_comp_reg_faixa_id", table_name="competition_registrations")
    op.drop_index("ix_comp_reg_modality", table_name="competition_registrations")
    op.drop_index("ix_comp_reg_kind", table_name="competition_registrations")

    op.alter_column("competition_registrations", "weight_class_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("competition_registrations", "age_division_id", existing_type=sa.Integer(), nullable=False)

    op.drop_column("competition_registrations", "registration_fee_amount")
    op.drop_column("competition_registrations", "faixa_id")
    op.drop_column("competition_registrations", "modality")
    op.drop_column("competition_registrations", "kind")

