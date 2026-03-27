from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MuralPost(Base):
    __tablename__ = "mural_posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dojo_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dojos.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    author_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    author_name: Mapped[str] = mapped_column(String(255))
    author_avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Lista de modalidades (por nome) para as quais o post é visível.
    # None = legado/global (visível para todos no dojo).
    modalidades: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

