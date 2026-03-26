from datetime import date

from pydantic import BaseModel, EmailStr, Field


class StudentBase(BaseModel):
    name: str
    email: EmailStr | None = None
    phone: str | None = None
    birth_date: date | None = None
    weight_kg: float | None = None
    modalidade: str | None = None
    notes: str | None = None
    master_notes: str | None = None
    master_notes_date: date | None = None


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
    weight_kg: float | None = Field(default=None, ge=0, le=500)
    modalidade: str | None = None
    notes: str | None = None
    master_notes: str | None = None
    master_notes_date: date | None = None
    faixa_id: int | None = None
    grau: int | None = None
    is_active: bool | None = None
    academic_mastered_techniques: list[str] | None = None
    academic_next_objectives: list[str] | None = None


class StudentRead(StudentBase):
    id: int
    dojo_id: int | None = None
    external_dojo_name: str | None = None
    external_faixa_label: str | None = None
    user_id: int | None = None
    faixa_id: int | None = None
    grau: int = 0
    graduacao: str | None = None  # preenchido na rota (não vem do ORM)
    # Catálogo de modalidades: se todas as modalidades do aluno forem "sem graduação", o app oculta faixa/graus.
    exibir_graduacao_no_perfil: bool = True
    # Sobrescreve StudentBase.email: EmailStr rejeita domínios como `.local` (seeds / imports).
    # Na leitura, o valor vem do banco e precisa ser serializado sem falhar.
    email: str | None = None
    academic_mastered_techniques: list[str] = Field(default_factory=list)
    academic_next_objectives: list[str] = Field(default_factory=list)

    class Config:
        from_attributes = True


class StudentCompetitionAwardRead(BaseModel):
    id: int
    competition_id: int
    kind: str
    age_division_id: int | None = None
    weight_class_id: int | None = None
    gender: str
    modality: str
    place: int
    awarded_at: str  # isoformat (evita timezone edge cases no app)
    reward: str | None = None
    competition_name: str | None = None
    reference_year: int | None = None


class StudentSelfUpdate(BaseModel):
    name: str | None = None
    birth_date: date | None = None
    weight_kg: float | None = Field(default=None, ge=0, le=500)


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

