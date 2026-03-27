"""add seminars/auloes domain (mvp)

Revision ID: add_seminars_mvp
Revises: add_mural_post_modalidades
Create Date: 2026-03-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "add_seminars_mvp"
down_revision: Union[str, None] = "add_mural_post_modalidades"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "seminars",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "organizer_dojo_id",
            sa.Integer(),
            sa.ForeignKey("dojos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("banner_url", sa.String(length=512), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location_text", sa.String(length=255), nullable=True),
        sa.Column("speaker_name", sa.String(length=255), nullable=True),
        sa.Column("speaker_bio", sa.Text(), nullable=True),
        sa.Column("speaker_photo_url", sa.String(length=512), nullable=True),
        sa.Column("speaker_achievements", sa.Text(), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_seminars_organizer_dojo_id", "seminars", ["organizer_dojo_id"])
    op.create_index("ix_seminars_is_published", "seminars", ["is_published"])
    op.create_index("ix_seminars_starts_at", "seminars", ["starts_at"])
    op.create_index("ix_seminars_ends_at", "seminars", ["ends_at"])

    op.create_table(
        "seminar_lots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "seminar_id",
            sa.Integer(),
            sa.ForeignKey("seminars.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("price_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("seminar_id", "order", name="uq_seminar_lot_order"),
    )
    op.create_index("ix_seminar_lots_seminar_id", "seminar_lots", ["seminar_id"])
    op.create_index("ix_seminar_lots_order", "seminar_lots", ["order"])
    op.create_index("ix_seminar_lots_starts_at", "seminar_lots", ["starts_at"])
    op.create_index("ix_seminar_lots_ends_at", "seminar_lots", ["ends_at"])

    op.create_table(
        "seminar_schedule_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "seminar_id",
            sa.Integer(),
            sa.ForeignKey("seminars.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=32), nullable=False, server_default="other"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_seminar_schedule_items_seminar_id",
        "seminar_schedule_items",
        ["seminar_id"],
    )
    op.create_index(
        "ix_seminar_schedule_items_kind", "seminar_schedule_items", ["kind"]
    )
    op.create_index(
        "ix_seminar_schedule_items_starts_at", "seminar_schedule_items", ["starts_at"]
    )
    op.create_index(
        "ix_seminar_schedule_items_ends_at", "seminar_schedule_items", ["ends_at"]
    )

    op.create_table(
        "seminar_registrations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "seminar_id",
            sa.Integer(),
            sa.ForeignKey("seminars.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "buyer_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("students.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("guest_full_name", sa.String(length=255), nullable=True),
        sa.Column("guest_email", sa.String(length=255), nullable=True),
        sa.Column("guest_phone", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column(
            "payment_status",
            sa.String(length=32),
            nullable=False,
            server_default="pending_payment",
        ),
        sa.Column("payment_receipt_path", sa.String(length=512), nullable=True),
        sa.Column("payment_notes", sa.Text(), nullable=True),
        sa.Column("payment_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_amount", sa.Float(), nullable=True),
        sa.Column("public_code", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("seminar_id", "student_id", name="uq_seminar_student"),
        sa.UniqueConstraint("seminar_id", "guest_email", name="uq_seminar_guest_email"),
    )
    op.create_index(
        "ix_seminar_registrations_seminar_id", "seminar_registrations", ["seminar_id"]
    )
    op.create_index(
        "ix_seminar_registrations_buyer_user_id",
        "seminar_registrations",
        ["buyer_user_id"],
    )
    op.create_index(
        "ix_seminar_registrations_student_id",
        "seminar_registrations",
        ["student_id"],
    )
    op.create_index(
        "ix_seminar_registrations_guest_email",
        "seminar_registrations",
        ["guest_email"],
    )
    op.create_index(
        "ix_seminar_registrations_status", "seminar_registrations", ["status"]
    )
    op.create_index(
        "ix_seminar_registrations_payment_status",
        "seminar_registrations",
        ["payment_status"],
    )
    op.create_index(
        "ix_seminar_registrations_public_code",
        "seminar_registrations",
        ["public_code"],
    )
    op.create_index(
        "ix_seminar_registrations_created_at",
        "seminar_registrations",
        ["created_at"],
    )

    op.create_table(
        "seminar_attendance",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "seminar_id",
            sa.Integer(),
            sa.ForeignKey("seminars.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "registration_id",
            sa.Integer(),
            sa.ForeignKey("seminar_registrations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "checked_in_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.UniqueConstraint(
            "registration_id", name="uq_seminar_attendance_registration"
        ),
    )
    op.create_index(
        "ix_seminar_attendance_seminar_id", "seminar_attendance", ["seminar_id"]
    )
    op.create_index(
        "ix_seminar_attendance_registration_id",
        "seminar_attendance",
        ["registration_id"],
    )
    op.create_index(
        "ix_seminar_attendance_checked_in_at",
        "seminar_attendance",
        ["checked_in_at"],
    )
    op.create_index(
        "ix_seminar_attendance_checked_in_by_user_id",
        "seminar_attendance",
        ["checked_in_by_user_id"],
    )


def downgrade() -> None:
    op.drop_table("seminar_attendance")
    op.drop_table("seminar_registrations")
    op.drop_table("seminar_schedule_items")
    op.drop_table("seminar_lots")
    op.drop_table("seminars")

