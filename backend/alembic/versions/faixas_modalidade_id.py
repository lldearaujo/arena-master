"""faixas.modalidade_id — faixas por modalidade do dojo

Revision ID: faixas_modalidade_id
Revises: modalidade_skills_labels
"""

from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision: str = "faixas_modalidade_id"
down_revision: Union[str, None] = "modalidade_skills_labels"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("faixas")}
    if "modalidade_id" in cols:
        return

    op.add_column("faixas", sa.Column("modalidade_id", sa.Integer(), nullable=True))

    bind.execute(
        text(
            """
            INSERT INTO dojo_modalidades (dojo_id, name, has_graduation_system, created_at)
            SELECT DISTINCT f.dojo_id, 'Geral', true, NOW()
            FROM faixas f
            WHERE NOT EXISTS (
                SELECT 1 FROM dojo_modalidades dm WHERE dm.dojo_id = f.dojo_id
            )
            """
        )
    )
    bind.execute(
        text(
            """
            UPDATE faixas AS f
            SET modalidade_id = (
                SELECT dm.id FROM dojo_modalidades dm
                WHERE dm.dojo_id = f.dojo_id
                ORDER BY dm.id ASC
                LIMIT 1
            )
            WHERE f.modalidade_id IS NULL
            """
        )
    )

    # Garante que nenhuma faixa ficou sem modalidade
    orphan = bind.execute(text("SELECT COUNT(*) FROM faixas WHERE modalidade_id IS NULL")).scalar()
    if orphan and int(orphan) > 0:
        raise RuntimeError("Migration faixas_modalidade_id: faixas sem modalidade após backfill")

    op.alter_column("faixas", "modalidade_id", nullable=False)
    op.create_foreign_key(
        "fk_faixas_modalidade_id",
        "faixas",
        "dojo_modalidades",
        ["modalidade_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_faixas_modalidade_id", "faixas", ["modalidade_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("faixas")}
    if "modalidade_id" not in cols:
        return
    fk_names = {fk["name"] for fk in insp.get_foreign_keys("faixas")}
    if "fk_faixas_modalidade_id" in fk_names:
        op.drop_constraint("fk_faixas_modalidade_id", "faixas", type_="foreignkey")
    idx_names = {ix["name"] for ix in insp.get_indexes("faixas")}
    if "ix_faixas_modalidade_id" in idx_names:
        op.drop_index("ix_faixas_modalidade_id", table_name="faixas")
    op.drop_column("faixas", "modalidade_id")
