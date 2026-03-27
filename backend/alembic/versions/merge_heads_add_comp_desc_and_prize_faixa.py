"""merge heads add_comp_desc and add_prize_faixa

Revision ID: merge_comp_desc_prize
Revises: add_comp_desc, add_prize_faixa
Create Date: 2026-03-26
"""

from typing import Sequence, Union


revision: str = "merge_comp_desc_prize"
down_revision: Union[str, tuple[str, ...], None] = ("add_comp_desc", "add_prize_faixa")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

