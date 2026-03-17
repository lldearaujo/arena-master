from datetime import date, datetime

from pydantic import BaseModel


class CheckInCreate(BaseModel):
    turma_id: int
    # Para turmas KIDS, obrigatório; para regulares, ignorado quando aluno faz o próprio check-in
    student_id: int | None = None


class CheckInRead(BaseModel):
    id: int
    dojo_id: int
    turma_id: int
    student_id: int
    student_name: str | None = None
    # Total de presenças confirmadas do aluno (score acumulado)
    score: int | None = None
    occurred_at: datetime
    checked_in_by_user_id: int | None = None
    presence_confirmed_at: datetime | None = None
    presence_confirmed_by_user_id: int | None = None
    marked_absent_at: datetime | None = None
    marked_absent_by_user_id: int | None = None

    class Config:
        from_attributes = True


class CheckInFilter(BaseModel):
    turma_id: int | None = None
    student_id: int | None = None
    start_date: date | None = None
    end_date: date | None = None

