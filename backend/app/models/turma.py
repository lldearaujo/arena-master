from datetime import datetime, time

from sqlalchemy import DateTime, Enum, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Turma(Base):
    __tablename__ = "turmas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dojo_id: Mapped[int] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    day_of_week: Mapped[str] = mapped_column(String(16), index=True)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    capacity: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(default=True)
    tipo: Mapped[str] = mapped_column(
        Enum("regular", "kids", name="turma_tipo"), default="regular", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

