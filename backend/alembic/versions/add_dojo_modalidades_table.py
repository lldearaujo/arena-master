"""add dojo_modalidades catalog table

Revision ID: add_dojo_modalidades
Revises: add_turma_modalidade
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_dojo_modalidades"
down_revision: Union[str, None] = "add_turma_modalidade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()
    if "dojo_modalidades" not in tables:
        op.create_table(
            "dojo_modalidades",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("dojo_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=64), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["dojo_id"],
                ["dojos.id"],
                ondelete="CASCADE",
            ),
            sa.UniqueConstraint(
                "dojo_id",
                "name",
                name="uq_dojo_modalidades_dojo_name",
            ),
        )
        op.create_index(
            "ix_dojo_modalidades_dojo_id", "dojo_modalidades", ["dojo_id"]
        )
    else:
        idx_names = {ix["name"] for ix in insp.get_indexes("dojo_modalidades")}
        if "ix_dojo_modalidades_dojo_id" not in idx_names:
            op.create_index(
                "ix_dojo_modalidades_dojo_id", "dojo_modalidades", ["dojo_id"]
            )


def downgrade() -> None:
    op.drop_index("ix_dojo_modalidades_dojo_id", table_name="dojo_modalidades")
    op.drop_table("dojo_modalidades")
