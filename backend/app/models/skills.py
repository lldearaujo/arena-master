from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DojoSkillsConfig(Base):
    __tablename__ = "dojo_skills_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dojo_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("dojos.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )

    skill_1: Mapped[str] = mapped_column(String(64))
    skill_2: Mapped[str] = mapped_column(String(64))
    skill_3: Mapped[str] = mapped_column(String(64))
    skill_4: Mapped[str] = mapped_column(String(64))
    skill_5: Mapped[str] = mapped_column(String(64))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class StudentSkillsRating(Base):
    __tablename__ = "student_skills_rating"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dojo_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("dojos.id", ondelete="CASCADE"),
        index=True,
    )
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )

    rating_1: Mapped[int] = mapped_column(SmallInteger, default=0)
    rating_2: Mapped[int] = mapped_column(SmallInteger, default=0)
    rating_3: Mapped[int] = mapped_column(SmallInteger, default=0)
    rating_4: Mapped[int] = mapped_column(SmallInteger, default=0)
    rating_5: Mapped[int] = mapped_column(SmallInteger, default=0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

