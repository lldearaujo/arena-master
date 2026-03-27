"""Modelos do domínio de seminários/aulões (eventos de imersão técnica)."""

from __future__ import annotations

import secrets
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _public_code() -> str:
    # Código curto digitável (fallback ao QR). 12 chars base32-ish.
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(12))


class Seminar(Base):
    __tablename__ = "seminars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    organizer_dojo_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dojos.id", ondelete="CASCADE"), index=True
    )

    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    # Novo padrão: cidade + UF (mantemos location_text como fallback/legado).
    location_city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    location_state: Mapped[str | None] = mapped_column(String(32), nullable=True)
    location_text: Mapped[str | None] = mapped_column(String(255), nullable=True)

    speaker_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    speaker_bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    speaker_photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    speaker_achievements: Mapped[str | None] = mapped_column(Text, nullable=True)

    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    # internal: visível só para alunos do dojo organizador; public: visível para todos os usuários.
    visibility: Mapped[str] = mapped_column(String(16), default="internal", index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class SeminarLot(Base):
    __tablename__ = "seminar_lots"
    __table_args__ = (
        UniqueConstraint("seminar_id", "order", name="uq_seminar_lot_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    seminar_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("seminars.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(128))
    price_amount: Mapped[float] = mapped_column(Float, default=0.0)
    starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    order: Mapped[int] = mapped_column(Integer, default=0, index=True)


class SeminarScheduleItem(Base):
    __tablename__ = "seminar_schedule_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    seminar_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("seminars.id", ondelete="CASCADE"), index=True
    )
    # intro|technique|drills|qa|sparring|graduation|other
    kind: Mapped[str] = mapped_column(String(32), default="other", index=True)
    starts_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class SeminarRegistration(Base):
    __tablename__ = "seminar_registrations"
    __table_args__ = (
        # Evita duplicar inscrição do mesmo aluno no mesmo seminário.
        UniqueConstraint("seminar_id", "student_id", name="uq_seminar_student"),
        # Evita duplicar convidado por email no mesmo seminário (quando informado).
        UniqueConstraint("seminar_id", "guest_email", name="uq_seminar_guest_email"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    seminar_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("seminars.id", ondelete="CASCADE"), index=True
    )
    buyer_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Participante aluno (interno) OU convidado (externo).
    student_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )
    guest_full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guest_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    guest_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)

    status: Mapped[str] = mapped_column(String(32), default="active", index=True)

    payment_status: Mapped[str] = mapped_column(
        String(32), default="pending_payment", index=True
    )
    payment_receipt_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    payment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_amount: Mapped[float | None] = mapped_column(Float, nullable=True)

    public_code: Mapped[str] = mapped_column(String(16), index=True, default=_public_code)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, index=True
    )


class SeminarAttendance(Base):
    __tablename__ = "seminar_attendance"
    __table_args__ = (
        UniqueConstraint("registration_id", name="uq_seminar_attendance_registration"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    seminar_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("seminars.id", ondelete="CASCADE"), index=True
    )
    registration_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("seminar_registrations.id", ondelete="CASCADE"),
        index=True,
    )
    checked_in_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, index=True
    )
    checked_in_by_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

