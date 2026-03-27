"""add event visibility (public/internal)

Revision ID: add_event_visibility
Revises: add_reg_multi_kind, add_seminar_city_state
Create Date: 2026-03-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "add_event_visibility"
down_revision: Union[str, tuple[str, str], None] = ("add_reg_multi_kind", "add_seminar_city_state")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(insp, table: str, col: str) -> bool:
    try:
        return col in {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return False


def _has_index(insp, table: str, index_name: str) -> bool:
    try:
        return index_name in {ix["name"] for ix in insp.get_indexes(table)}
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # competitions.visibility
    if not _has_column(insp, "competitions", "visibility"):
        op.add_column(
            "competitions",
            sa.Column("visibility", sa.String(length=16), nullable=False, server_default="internal"),
        )
    if not _has_index(insp, "competitions", "ix_competitions_visibility"):
        op.create_index("ix_competitions_visibility", "competitions", ["visibility"])

    # seminars.visibility
    if not _has_column(insp, "seminars", "visibility"):
        op.add_column(
            "seminars",
            sa.Column("visibility", sa.String(length=16), nullable=False, server_default="internal"),
        )
    if not _has_index(insp, "seminars", "ix_seminars_visibility"):
        op.create_index("ix_seminars_visibility", "seminars", ["visibility"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if _has_index(insp, "seminars", "ix_seminars_visibility"):
        op.drop_index("ix_seminars_visibility", table_name="seminars")
    if _has_column(insp, "seminars", "visibility"):
        op.drop_column("seminars", "visibility")

    if _has_index(insp, "competitions", "ix_competitions_visibility"):
        op.drop_index("ix_competitions_visibility", table_name="competitions")
    if _has_column(insp, "competitions", "visibility"):
        op.drop_column("competitions", "visibility")

