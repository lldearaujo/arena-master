"""add dojo skills config and student ratings

Revision ID: add_dojo_skills
Revises: add_checkin_presence
Create Date: 2026-03-17

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_dojo_skills"
down_revision: Union[str, None] = "add_checkin_presence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    names = set(insp.get_table_names())

    if "dojo_skills_config" not in names:
        op.create_table(
            "dojo_skills_config",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "dojo_id",
                sa.Integer(),
                sa.ForeignKey("dojos.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
            sa.Column("skill_1", sa.String(length=64), nullable=False),
            sa.Column("skill_2", sa.String(length=64), nullable=False),
            sa.Column("skill_3", sa.String(length=64), nullable=False),
            sa.Column("skill_4", sa.String(length=64), nullable=False),
            sa.Column("skill_5", sa.String(length=64), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index(
            "ix_dojo_skills_config_dojo_id", "dojo_skills_config", ["dojo_id"]
        )

    if "student_skills_rating" not in names:
        op.create_table(
            "student_skills_rating",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "dojo_id",
                sa.Integer(),
                sa.ForeignKey("dojos.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "student_id",
                sa.Integer(),
                sa.ForeignKey("students.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
            sa.Column("rating_1", sa.SmallInteger(), nullable=False, server_default="0"),
            sa.Column("rating_2", sa.SmallInteger(), nullable=False, server_default="0"),
            sa.Column("rating_3", sa.SmallInteger(), nullable=False, server_default="0"),
            sa.Column("rating_4", sa.SmallInteger(), nullable=False, server_default="0"),
            sa.Column("rating_5", sa.SmallInteger(), nullable=False, server_default="0"),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index(
            "ix_student_skills_rating_dojo_id", "student_skills_rating", ["dojo_id"]
        )
        op.create_index(
            "ix_student_skills_rating_student_id",
            "student_skills_rating",
            ["student_id"],
        )


def downgrade() -> None:
    op.drop_index("ix_student_skills_rating_student_id", table_name="student_skills_rating")
    op.drop_index("ix_student_skills_rating_dojo_id", table_name="student_skills_rating")
    op.drop_table("student_skills_rating")

    op.drop_index("ix_dojo_skills_config_dojo_id", table_name="dojo_skills_config")
    op.drop_table("dojo_skills_config")

