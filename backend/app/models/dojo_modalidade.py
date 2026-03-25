from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DojoModalidade(Base):
    """Modalidade cadastrada pelo dojo (catálogo para turmas e formulários)."""

    __tablename__ = "dojo_modalidades"
    __table_args__ = (
        UniqueConstraint("dojo_id", "name", name="uq_dojo_modalidades_dojo_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dojo_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    has_graduation_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    # 5 rótulos para radar de habilidades; NULL = usar padrão do dojo (dojo_skills_config).
    skills_labels: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
