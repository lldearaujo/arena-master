"""add faixas and student graduacao

Revision ID: add_faixas
Revises: add_avatar
Create Date: 2025-03-12

"""
from alembic import op
import sqlalchemy as sa


revision = "add_faixas"
down_revision = "add_avatar"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "faixas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("dojo_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_graus", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("exibir_como_dan", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["dojo_id"], ["dojos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_faixas_dojo_id"), "faixas", ["dojo_id"], unique=False)
    op.create_index(op.f("ix_faixas_id"), "faixas", ["id"], unique=False)

    op.add_column("students", sa.Column("faixa_id", sa.Integer(), nullable=True))
    op.add_column("students", sa.Column("grau", sa.Integer(), nullable=False, server_default="0"))
    op.create_foreign_key(
        "fk_students_faixa_id",
        "students",
        "faixas",
        ["faixa_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_students_faixa_id"), "students", ["faixa_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_students_faixa_id"), table_name="students")
    op.drop_constraint("fk_students_faixa_id", "students", type_="foreignkey")
    op.drop_column("students", "grau")
    op.drop_column("students", "faixa_id")

    op.drop_index(op.f("ix_faixas_id"), table_name="faixas")
    op.drop_index(op.f("ix_faixas_dojo_id"), table_name="faixas")
    op.drop_table("faixas")
