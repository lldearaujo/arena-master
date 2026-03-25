from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Faixa(Base):
    """Faixa/graduação por modalidade do dojo (ex.: Branca, Azul, Preta no Jiu-Jitsu)."""

    __tablename__ = "faixas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dojo_id: Mapped[int] = mapped_column(Integer, ForeignKey("dojos.id", ondelete="CASCADE"), index=True)
    modalidade_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dojo_modalidades.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(64))
    ordem: Mapped[int] = mapped_column(Integer, default=0)
    max_graus: Mapped[int] = mapped_column(Integer, default=4)
    exibir_como_dan: Mapped[bool] = mapped_column(default=False)
