from datetime import time

from pydantic import BaseModel, Field, field_validator


class TurmaBase(BaseModel):
    name: str
    description: str | None = None
    modalidade: str | None = None
    day_of_week: str
    start_time: time
    end_time: time
    capacity: int
    active: bool = True
    tipo: str = "regular"


class TurmaCreate(TurmaBase):
    modalidade: str = Field(min_length=1, max_length=64)

    @field_validator("modalidade")
    @classmethod
    def strip_modalidade(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Modalidade não pode ser vazia")
        return s


class TurmaUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    modalidade: str | None = None
    day_of_week: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    capacity: int | None = None
    active: bool | None = None
    tipo: str | None = None

    @field_validator("modalidade")
    @classmethod
    def strip_modalidade_update(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        return s if s else None


class TurmaRead(TurmaBase):
    id: int
    dojo_id: int

    class Config:
        from_attributes = True


class TurmaMyRead(TurmaRead):
    """Turma com vagas restantes no dia (para lista 'Minhas turmas')."""

    vagas_restantes: int


class EnrollmentRequest(BaseModel):
    student_id: int


class TurmaCheckInAttendee(BaseModel):
    """Aluno que fez check-in na turma na data informada."""

    student_id: int
    student_name: str
    graduacao: str | None = None
    avatar_url: str | None = None

