"""Add competitions.event_modality for app catalog filter.

Revision ID: add_comp_event_mod
Revises: dojo_mod_grad
Create Date: 2026-03-25
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "add_comp_event_mod"
down_revision = "dojo_mod_grad"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "competitions",
        sa.Column("event_modality", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_competitions_event_modality",
        "competitions",
        ["event_modality"],
    )


def downgrade() -> None:
    op.drop_index("ix_competitions_event_modality", table_name="competitions")
    op.drop_column("competitions", "event_modality")

