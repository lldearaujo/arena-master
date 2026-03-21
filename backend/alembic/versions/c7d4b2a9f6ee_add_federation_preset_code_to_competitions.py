"""add federation_preset_code to competitions

Used to enable the scorekeeper UI only after the organizer applies
the federation preset (IBJJF/CBJJ, GI/No-Gi).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c7d4b2a9f6ee"
down_revision: Union[str, None] = "add_competitions_fcm"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns("competitions")]
    if "federation_preset_code" not in cols:
        op.add_column(
            "competitions",
            sa.Column("federation_preset_code", sa.String(length=64), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns("competitions")]
    if "federation_preset_code" in cols:
        op.drop_column("competitions", "federation_preset_code")

