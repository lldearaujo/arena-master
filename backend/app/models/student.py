from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Nulo para atletas criados só por inscrição pública (dojo informado em texto).
    dojo_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    faixa_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("faixas.id", ondelete="SET NULL"), nullable=True, index=True
    )
    grau: Mapped[int] = mapped_column(Integer, default=0)
    modalidade: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    master_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    master_notes_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    external_dojo_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    external_faixa_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # JSON array of strings (UTF-8), configurável pelo professor no painel web.
    academic_mastered_techniques: Mapped[str | None] = mapped_column(Text, nullable=True)
    academic_next_objectives: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

