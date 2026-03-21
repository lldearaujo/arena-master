"""users.fcm_token for push notifications

Revision ID: add_competitions_fcm
Revises: add_dojo_modalidades

Tabelas de competição são criadas via SQLAlchemy Base.metadata.create_all no startup.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_competitions_fcm"
down_revision: Union[str, None] = "add_dojo_modalidades"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = [c["name"] for c in insp.get_columns("users")]
    if "fcm_token" not in cols:
        op.add_column("users", sa.Column("fcm_token", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "fcm_token")
