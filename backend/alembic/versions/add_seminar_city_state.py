"""add seminar location city/state

Revision ID: add_seminar_city_state
Revises: add_seminars_mvp
Create Date: 2026-03-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "add_seminar_city_state"
down_revision: Union[str, None] = "add_seminars_mvp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("seminars", sa.Column("location_city", sa.String(length=128), nullable=True))
    op.add_column("seminars", sa.Column("location_state", sa.String(length=32), nullable=True))
    op.create_index("ix_seminars_location_city", "seminars", ["location_city"])
    op.create_index("ix_seminars_location_state", "seminars", ["location_state"])


def downgrade() -> None:
    op.drop_index("ix_seminars_location_state", table_name="seminars")
    op.drop_index("ix_seminars_location_city", table_name="seminars")
    op.drop_column("seminars", "location_state")
    op.drop_column("seminars", "location_city")

