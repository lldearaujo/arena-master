from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.modules.finance.schemas import PlanRead


class MatriculaDojoRead(BaseModel):
    id: int
    name: str
    logo_url: str | None = None
    contato: str | None = None
    slug: str | None = None


class FaixaOption(BaseModel):
    id: int
    name: str
    max_graus: int
    exibir_como_dan: bool = False


class MatriculaLinkGenerateResponse(BaseModel):
    token: str


class MatriculaFormResponse(BaseModel):
    dojo: MatriculaDojoRead
    plans: list[PlanRead]
    modalidades: list[str]
    faixas: list[FaixaOption]


class MatriculaStudentCreate(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)

    phone: str | None = None
    modalidade: str | None = None
    faixa_id: int | None = None
    # Mantém o grau/dan para a faixa selecionada (ou 0 quando não aplicável).
    grau: int = Field(default=0, ge=0)


class MatriculaSubmitRequest(BaseModel):
    type: Literal["regular", "kids"]
    plan_id: int
    student: MatriculaStudentCreate


class MatriculaSubmitResponse(BaseModel):
    status: Literal["created", "existing"]
    login_email: str
    message: str

