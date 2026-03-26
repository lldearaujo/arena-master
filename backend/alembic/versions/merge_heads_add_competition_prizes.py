"""Merge alembic heads and add competition prizes.

Revision ID: merge_prizes
Revises: add_comp_event_mod, 9b8a4c2d1f10
Create Date: 2026-03-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "merge_prizes"
down_revision: Union[str, tuple[str, ...], None] = ("add_comp_event_mod", "9b8a4c2d1f10")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())
    if "competition_prizes" not in tables:
        op.create_table(
            "competition_prizes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("competition_id", sa.Integer(), nullable=False),
            sa.Column("kind", sa.String(length=16), nullable=False),
            sa.Column("age_division_id", sa.Integer(), nullable=True),
            sa.Column("gender", sa.String(length=16), nullable=False),
            sa.Column("modality", sa.String(length=8), nullable=False),
            sa.Column("place", sa.Integer(), nullable=False),
            sa.Column("reward", sa.String(length=255), nullable=False),
            sa.ForeignKeyConstraint(["competition_id"], ["competitions.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["age_division_id"], ["competition_age_divisions.id"], ondelete="CASCADE"),
            sa.UniqueConstraint(
                "competition_id",
                "kind",
                "age_division_id",
                "gender",
                "modality",
                "place",
                name="uq_comp_prize_target_place",
            ),
        )
    existing_indexes = {ix["name"] for ix in insp.get_indexes("competition_prizes")}
    if "ix_comp_prizes_competition_id" not in existing_indexes:
        op.create_index(
            "ix_comp_prizes_competition_id",
            "competition_prizes",
            ["competition_id"],
        )
    if "ix_comp_prizes_kind" not in existing_indexes:
        op.create_index("ix_comp_prizes_kind", "competition_prizes", ["kind"])
    if "ix_comp_prizes_gender" not in existing_indexes:
        op.create_index("ix_comp_prizes_gender", "competition_prizes", ["gender"])
    if "ix_comp_prizes_modality" not in existing_indexes:
        op.create_index("ix_comp_prizes_modality", "competition_prizes", ["modality"])
    if "ix_comp_prizes_age_division_id" not in existing_indexes:
        op.create_index(
            "ix_comp_prizes_age_division_id",
            "competition_prizes",
            ["age_division_id"],
        )


def downgrade() -> None:
    op.drop_index("ix_comp_prizes_age_division_id", table_name="competition_prizes")
    op.drop_index("ix_comp_prizes_modality", table_name="competition_prizes")
    op.drop_index("ix_comp_prizes_gender", table_name="competition_prizes")
    op.drop_index("ix_comp_prizes_kind", table_name="competition_prizes")
    op.drop_index("ix_comp_prizes_competition_id", table_name="competition_prizes")
    op.drop_table("competition_prizes")

