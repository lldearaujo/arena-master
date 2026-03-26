from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

GenderLiteral = str  # "male" | "female"


class CompetitionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    reference_year: int
    event_starts_at: datetime | None = None
    default_match_duration_seconds: int = 360
    transition_buffer_seconds: int = 90
    is_published: bool = False
    registration_fee_amount: float | None = Field(default=None, ge=0)
    registration_payment_instructions: str | None = None
    event_modality: str | None = Field(default=None, min_length=1, max_length=64)


class CompetitionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    reference_year: int | None = None
    event_starts_at: datetime | None = None
    default_match_duration_seconds: int | None = None
    transition_buffer_seconds: int | None = None
    is_published: bool | None = None
    registration_fee_amount: float | None = Field(default=None, ge=0)
    registration_payment_instructions: str | None = None
    event_modality: str | None = Field(default=None, min_length=1, max_length=64)


class CompetitionRead(BaseModel):
    id: int
    organizer_dojo_id: int
    name: str
    reference_year: int
    event_starts_at: datetime | None
    default_match_duration_seconds: int
    transition_buffer_seconds: int
    public_display_token: str
    is_published: bool
    created_at: datetime
    federation_preset_code: str | None = None
    registration_fee_amount: float | None = None
    registration_payment_instructions: str | None = None
    event_modality: str | None = None
    banner_url: str | None = None
    # Preenchidos na leitura (não vêm do ORM) — útil para inscrição / UI pública.
    organizer_dojo_name: str | None = None
    organizer_logo_url: str | None = None

    class Config:
        from_attributes = True


class CompetitionPrizeCreate(BaseModel):
    kind: str = Field(..., pattern="^(category|absolute)$")
    age_division_id: int | None = None
    faixa_id: int | None = None
    gender: str = Field(..., pattern="^(male|female)$")
    modality: str = Field(..., pattern="^(gi|nogi)$")
    place: int = Field(..., ge=1, le=10)
    reward: str = Field(..., min_length=1, max_length=255)


class CompetitionPrizeRead(BaseModel):
    id: int
    competition_id: int
    kind: str
    age_division_id: int | None = None
    faixa_id: int | None = None
    gender: str
    modality: str
    place: int
    reward: str

    class Config:
        from_attributes = True


class CompetitionAwardCreate(BaseModel):
    student_id: int
    prize_id: int | None = None
    kind: str = Field(..., pattern="^(category|absolute)$")
    age_division_id: int | None = None
    weight_class_id: int | None = None
    gender: str = Field(..., pattern="^(male|female)$")
    modality: str = Field(..., pattern="^(gi|nogi)$")
    place: int = Field(..., ge=1, le=10)


class CompetitionAwardRead(BaseModel):
    id: int
    competition_id: int
    student_id: int
    prize_id: int | None = None
    kind: str
    age_division_id: int | None = None
    weight_class_id: int | None = None
    gender: str
    modality: str
    place: int
    awarded_at: datetime
    # preenchidos no service (não vêm do ORM) para UI/perfil
    reward: str | None = None
    student_name: str | None = None


class AgeDivisionCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=128)
    birth_year_min: int
    birth_year_max: int
    sort_order: int = 0


class AgeDivisionRead(BaseModel):
    id: int
    competition_id: int
    label: str
    birth_year_min: int
    birth_year_max: int
    sort_order: int

    class Config:
        from_attributes = True


class WeightClassCreate(BaseModel):
    age_division_id: int
    gender: str = Field(..., pattern="^(male|female)$")
    label: str = Field(..., min_length=1, max_length=128)
    max_weight_kg: float | None = None
    sort_order: int = 0
    modality: str = Field(default="gi", pattern="^(gi|nogi)$")


class WeightClassRead(BaseModel):
    id: int
    competition_id: int
    age_division_id: int
    gender: str
    modality: str
    label: str
    max_weight_kg: float | None
    sort_order: int
    # Calculado no servidor a partir da ordem das categorias (ex.: "57,5–64 kg").
    weight_interval_label: str | None = None

    class Config:
        from_attributes = True


class BeltEligibilityCreate(BaseModel):
    age_division_id: int
    gender: str = Field(..., pattern="^(male|female)$")
    faixa_id: int


class BeltEligibilityRead(BaseModel):
    id: int
    competition_id: int
    age_division_id: int
    gender: str
    faixa_id: int

    class Config:
        from_attributes = True


class CompetitionKpiItem(BaseModel):
    """Métricas agregadas por competição (organizadores / superadmin)."""

    competition_id: int
    name: str
    reference_year: int
    is_published: bool
    organizer_dojo_id: int
    registrations_total: int
    registrations_registered: int
    registrations_weighed_in: int
    registrations_disqualified: int
    brackets_count: int = 0
    pending_registration_payment_confirmations: int = 0


class FederationPresetSummary(BaseModel):
    code: str
    label: str
    description: str
    federation: str
    modality: str


class ApplyFederationPresetBody(BaseModel):
    preset_code: str = Field(..., min_length=1, max_length=64)


class ApplyFederationPresetResponse(BaseModel):
    preset_code: str
    reference_year_used: int
    age_divisions_created: int
    weight_classes_created: int
    belt_eligibility_created: int
    # Faixas do modelo sem correspondência no cadastro do dojo (linhas de elegibilidade omitidas).
    skipped_belt_keys: list[str] = Field(default_factory=list)


class EligibilityAgeOption(BaseModel):
    age_division: AgeDivisionRead
    allowed_faixa_ids: list[int]


class EligibilityWeightOption(BaseModel):
    weight_class: WeightClassRead


class FaixaOption(BaseModel):
    id: int
    label: str


class EligibilityOptionsResponse(BaseModel):
    age_divisions: list[EligibilityAgeOption]
    weight_classes: list[EligibilityWeightOption]
    allowed_faixas: list[FaixaOption] = []


class RegistrationCreate(BaseModel):
    student_id: int
    gender: str = Field(..., pattern="^(male|female)$")
    age_division_id: int
    weight_class_id: int


class RegistrationRead(BaseModel):
    id: int
    competition_id: int
    student_id: int
    gender: str
    age_division_id: int
    weight_class_id: int
    status: str
    declared_weight_kg: float | None = None
    actual_weight_kg: float | None
    registration_public_code: str
    ranking_points: float
    weigh_in_at: datetime | None
    student_name: str | None = None
    student_dojo_id: int | None = None
    # Nome do dojo quando o aluno está vinculado a um dojo cadastrado no sistema.
    student_dojo_name: str | None = None
    student_external_dojo_name: str | None = None
    # Graduação/grad — quando o aluno tem `faixa_id` cadastrado no dojo.
    # Para inscrição pública sem cadastro de faixa no sistema, cai em `None` e o front usa `student_external_faixa_label`.
    student_faixa_id: int | None = None
    student_faixa_label: str | None = None
    student_external_faixa_label: str | None = None
    payment_status: str = "not_applicable"
    payment_receipt_path: str | None = None
    payment_notes: str | None = None
    payment_confirmed_at: datetime | None = None
    competition_name: str | None = None
    registration_fee_amount: float | None = None
    registration_payment_instructions: str | None = None
    age_division_label: str | None = None
    weight_class_label: str | None = None

    class Config:
        from_attributes = True


class RegistrationPaymentRejectBody(BaseModel):
    notes: str | None = None


class RegistrationPaymentConfirmBody(BaseModel):
    """Confirma pagamento de inscrição.

    Por padrão, só confirma quando já há comprovante enviado (pending_confirmation).
    Use `force_without_receipt` para permitir confirmação manual sem arquivo.
    """

    force_without_receipt: bool = False


class PublicCompetitionRegistrationCreate(BaseModel):
    """Inscrição sem conta prévia: cria usuário (aluno), aluno e inscrição."""

    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    external_dojo_name: str = Field(..., min_length=1, max_length=255)
    external_faixa_label: str = Field(..., min_length=1, max_length=255)
    birth_year: int = Field(..., ge=1920, le=date.today().year - 2)
    declared_weight_kg: float = Field(..., gt=0, le=400)
    gender: str = Field(..., pattern="^(male|female)$")
    age_division_id: int
    weight_class_id: int


class PublicRegistrationUserRead(BaseModel):
    id: int
    email: str
    role: str
    dojo_id: int | None = None

    class Config:
        from_attributes = True


class PublicCompetitionRegistrationResponse(BaseModel):
    registration: RegistrationRead
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: PublicRegistrationUserRead


class WeighInPayload(BaseModel):
    actual_weight_kg: float
    notes: str | None = None
    # Quando o peso conferido fica fora do limite da categoria atual,
    # o front pode pedir ao usuário para escolher entre:
    # - reclassificar para uma categoria compatível (weight_class_id muda)
    # - desclassificar (status = disqualified)
    # Se este campo vier null/ausente e a reclassificação for possível,
    # o back retorna 409 com a sugestão de categoria.
    reclassify_decision: str | None = Field(default=None, pattern="^(reclassify|disqualify)$")


class WeighInSearchResult(BaseModel):
    registration: RegistrationRead
    student_name: str
    weight_class_label: str


class BracketGenerateResponse(BaseModel):
    bracket_id: int
    matches_created: int
    warnings: str | None


class BracketsGenerateAllResponse(BaseModel):
    total_weight_classes_to_check: int
    generated_brackets: int
    skipped_weight_classes: int
    generated_bracket_ids: list[int]
    warnings: list[str] = Field(default_factory=list)


class BracketRead(BaseModel):
    id: int
    competition_id: int
    age_division_id: int
    weight_class_id: int
    gender: str
    generated_at: datetime
    team_separation_warnings: str | None

    class Config:
        from_attributes = True


class RankingPointsBody(BaseModel):
    points: float = 0.0


class PromoteRegistrationPayload(BaseModel):
    target_age_division_id: int | None = None
    target_weight_class_id: int | None = None


class MatCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    display_order: int = 0


class MatRead(BaseModel):
    id: int
    competition_id: int
    name: str
    display_order: int

    class Config:
        from_attributes = True


class AssignMatchMatPayload(BaseModel):
    mat_id: int | None
    queue_order: int | None = None


class PublicMatchBrief(BaseModel):
    id: int
    mat_id: int | None
    queue_order: int | None
    estimated_start_at: datetime | None
    match_status: str
    red_name: str | None
    blue_name: str | None


class PublicMatStatus(BaseModel):
    mat: MatRead
    on_mat: PublicMatchBrief | None
    on_deck: PublicMatchBrief | None
    warm_up: list[PublicMatchBrief]


class MatchScoreUpdate(BaseModel):
    red_score: int | None = None
    blue_score: int | None = None
    timer_elapsed_seconds: int | None = None
    timer_running: bool | None = None
    paused_for: str | None = None
    match_status: str | None = None


class MatchFinishPayload(BaseModel):
    winner_side: str = Field(..., pattern="^(red|blue|none)$")
    finish_method: str
    referee_decision: bool = False


class CoachStudentFight(BaseModel):
    registration_id: int
    student_id: int
    student_name: str
    match_id: int | None
    mat_name: str | None
    estimated_start_at: datetime | None
    match_status: str


class CoachConflict(BaseModel):
    student_a_name: str
    student_b_name: str
    mat_a: str | None
    mat_b: str | None
    overlap_start: datetime
    overlap_end: datetime


class CoachDashboardResponse(BaseModel):
    fights: list[CoachStudentFight]
    conflicts: list[CoachConflict]


class FcmTokenPayload(BaseModel):
    fcm_token: str = Field(..., min_length=10)


class MatchRead(BaseModel):
    id: int
    bracket_id: int
    round_index: int
    position_in_round: int
    red_registration_id: int | None
    blue_registration_id: int | None
    winner_registration_id: int | None
    mat_id: int | None
    queue_order: int | None
    estimated_start_at: datetime | None
    match_status: str
    red_score: int
    blue_score: int
    timer_elapsed_seconds: int
    timer_running: bool
    paused_for: str | None
    finish_method: str | None
    feeder_red_match_id: int | None = None
    feeder_blue_match_id: int | None = None

    class Config:
        from_attributes = True
