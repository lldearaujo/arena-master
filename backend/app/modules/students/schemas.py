from datetime import date

from pydantic import BaseModel, EmailStr


class StudentBase(BaseModel):
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    birth_date: date | None = None
    notes: str | None = None


class StudentCreate(StudentBase):
    user_id: int | None = None
    faixa_id: int | None = None
    grau: int = 0


class StudentUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    birth_date: date | None = None
    notes: str | None = None
    faixa_id: int | None = None
    grau: int | None = None


class StudentRead(StudentBase):
    id: int
    dojo_id: int
    user_id: int | None = None
    faixa_id: int | None = None
    grau: int = 0
    graduacao: str | None = None  # preenchido na rota (não vem do ORM)

    class Config:
        from_attributes = True


class StudentCreatedResponse(BaseModel):
    student: StudentRead
    initial_password: str
    login_email: str


class StudentWithLoginRead(StudentRead):
    login_email: str | None = None


class GuardianLink(BaseModel):
    user_id: int


class GuardianRead(BaseModel):
    id: int
    dojo_id: int
    user_id: int
    student_id: int

    class Config:
        from_attributes = True

