"""add competition awards table (medals/podium)

Revision ID: add_comp_awards
Revises: add_stu_acad_prog
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_comp_awards"
down_revision: Union[str, None] = "add_stu_acad_prog"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "competition_awards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "competition_id",
            sa.Integer(),
            sa.ForeignKey("competitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "prize_id",
            sa.Integer(),
            sa.ForeignKey("competition_prizes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column(
            "age_division_id",
            sa.Integer(),
            sa.ForeignKey("competition_age_divisions.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "weight_class_id",
            sa.Integer(),
            sa.ForeignKey("competition_weight_classes.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("gender", sa.String(length=16), nullable=False),
        sa.Column("modality", sa.String(length=8), nullable=False),
        sa.Column("place", sa.Integer(), nullable=False),
        sa.Column(
            "awarded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.UniqueConstraint(
            "competition_id",
            "kind",
            "age_division_id",
            "weight_class_id",
            "gender",
            "modality",
            "place",
            name="uq_comp_award_target_place",
        ),
        sa.UniqueConstraint(
            "competition_id",
            "student_id",
            "kind",
            "age_division_id",
            "weight_class_id",
            "gender",
            "modality",
            name="uq_comp_award_student_target",
        ),
    )

    op.create_index(
        "ix_comp_awards_competition_id",
        "competition_awards",
        ["competition_id"],
    )
    op.create_index(
        "ix_comp_awards_student_id",
        "competition_awards",
        ["student_id"],
    )
    op.create_index(
        "ix_comp_awards_prize_id",
        "competition_awards",
        ["prize_id"],
    )
    op.create_index(
        "ix_comp_awards_kind",
        "competition_awards",
        ["kind"],
    )
    op.create_index(
        "ix_comp_awards_gender",
        "competition_awards",
        ["gender"],
    )
    op.create_index(
        "ix_comp_awards_modality",
        "competition_awards",
        ["modality"],
    )
    op.create_index(
        "ix_comp_awards_age_division_id",
        "competition_awards",
        ["age_division_id"],
    )
    op.create_index(
        "ix_comp_awards_weight_class_id",
        "competition_awards",
        ["weight_class_id"],
    )
    op.create_index(
        "ix_comp_awards_awarded_at",
        "competition_awards",
        ["awarded_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_comp_awards_awarded_at", table_name="competition_awards")
    op.drop_index("ix_comp_awards_weight_class_id", table_name="competition_awards")
    op.drop_index("ix_comp_awards_age_division_id", table_name="competition_awards")
    op.drop_index("ix_comp_awards_modality", table_name="competition_awards")
    op.drop_index("ix_comp_awards_gender", table_name="competition_awards")
    op.drop_index("ix_comp_awards_kind", table_name="competition_awards")
    op.drop_index("ix_comp_awards_prize_id", table_name="competition_awards")
    op.drop_index("ix_comp_awards_student_id", table_name="competition_awards")
    op.drop_index("ix_comp_awards_competition_id", table_name="competition_awards")
    op.drop_table("competition_awards")

