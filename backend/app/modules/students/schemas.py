from datetime import date

from pydantic import BaseModel, EmailStr


class StudentBase(BaseModel):
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    birth_date: date | None = None
    modalidade: str | None = None
    notes: str | None = None


class StudentCreate(StudentBase):
    user_id: int | None = None
    faixa_id: int | None = None
    grau: int = 0
    is_active: bool = True


class StudentUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    birth_date: date | None = None
    modalidade: str | None = None
    notes: str | None = None
    faixa_id: int | None = None
    grau: int | None = None
    is_active: bool | None = None


class StudentRead(StudentBase):
    id: int
    dojo_id: int | None = None
    external_dojo_name: str | None = None
    external_faixa_label: str | None = None
    user_id: int | None = None
    faixa_id: int | None = None
    grau: int = 0
    graduacao: str | None = None  # preenchido na rota (não vem do ORM)
    # Sobrescreve StudentBase.email: EmailStr rejeita domínios como `.local` (seeds / imports).
    # Na leitura, o valor vem do banco e precisa ser serializado sem falhar.
    email: str | None = None

    class Config:
        from_attributes = True


class StudentCreatedResponse(BaseModel):
    student: StudentRead
    initial_password: str
    login_email: str


class StudentPasswordResetResponse(BaseModel):
    """Resposta após o professor zerar a senha do aluno para o padrão."""

    default_password: str
    login_email: str


class StudentWithLoginRead(StudentRead):
    login_email: str | None = None
    is_active: bool = True


class GuardianLink(BaseModel):
    user_id: int


class GuardianRead(BaseModel):
    id: int
    dojo_id: int
    user_id: int
    student_id: int

    class Config:
        from_attributes = True

