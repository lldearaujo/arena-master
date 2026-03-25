from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.finance import (
    PaymentMethod,
    PaymentStatus,
    StudentSubscriptionRecurrence,
    StudentSubscriptionStatus,
)


class PlanBase(BaseModel):
    name: str
    description: str | None = None
    # Vazio/null = plano para qualquer modalidade; uma ou mais = restrito a essas modalidades
    modalidades: list[str] | None = None
    price: float = Field(gt=0)
    credits_total: int = Field(gt=0)
    validity_days: int = Field(default=30, gt=0)


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    modalidades: list[str] | None = None
    price: float | None = Field(default=None, gt=0)
    credits_total: int | None = Field(default=None, gt=0)
    validity_days: int | None = Field(default=None, gt=0)
    active: bool | None = None


class PlanRead(PlanBase):
    id: int
    dojo_id: int
    active: bool

    class Config:
        from_attributes = True


class StudentSubscriptionBase(BaseModel):
    plan_id: int
    recurrence_type: StudentSubscriptionRecurrence = StudentSubscriptionRecurrence.NONE
    # Data de vencimento definida pelo professor (opcional).
    # Se não informada, o backend pode calcular usando validity_days do plano.
    end_date: date | None = None


class StudentSubscriptionCreate(StudentSubscriptionBase):
    end_date: date | None = None


class StudentSubscriptionRead(BaseModel):
    id: int
    dojo_id: int
    student_id: int
    plan_id: int
    status: StudentSubscriptionStatus
    start_date: date | None
    end_date: date | None
    credits_total: int
    credits_used: int
    credits_remaining: int
    recurrence_type: StudentSubscriptionRecurrence

    class Config:
        from_attributes = True


class PaymentBase(BaseModel):
    amount: float = Field(gt=0)


class PaymentCreateForSubscription(PaymentBase):
    subscription_id: int


class PaymentRead(BaseModel):
    id: int
    dojo_id: int
    student_id: int
    subscription_id: int | None
    amount: float
    student_name: str | None = None
    method: PaymentMethod
    status: PaymentStatus
    payment_date: datetime | None
    confirmed_at: datetime | None
    receipt_path: str | None
    notes: str | None = None

    class Config:
        from_attributes = True


class ChangePlanRequest(BaseModel):
    """Payload para o aluno alterar o próprio plano."""

    plan_id: int


class PaymentConfirmRequest(BaseModel):
    """Payload opcional para confirmação manual."""

    payment_date: datetime | None = None
    notes: str | None = None


class PaymentRejectRequest(BaseModel):
    reason: str | None = None


class PixConfigBase(BaseModel):
    key_type: str
    key_value: str
    recipient_name: str | None = None
    bank_name: str | None = None
    instructions: str | None = None


class PixConfigUpdate(PixConfigBase):
    static_qr_image_path: str | None = None


class PixConfigRead(PixConfigBase):
    dojo_id: int
    static_qr_image_path: str | None = None

    class Config:
        from_attributes = True


class FinanceSummarySubscription(BaseModel):
    id: int
    plan_id: int
    plan_name: str
    status: StudentSubscriptionStatus
    start_date: date | None
    end_date: date | None
    credits_total: int
    credits_used: int
    credits_remaining: int


class FinancePaymentSummary(BaseModel):
    id: int
    amount: float
    status: PaymentStatus
    created_at: datetime
    payment_date: datetime | None
    confirmed_at: datetime | None
    plan_name: str | None = None
    end_date: date | None = None
    receipt_path: str | None = None


class FinanceSummary(BaseModel):
    active_subscription: FinanceSummarySubscription | None = None
    subscriptions: list[FinanceSummarySubscription]
    payments: list[FinancePaymentSummary]
    pix_config: PixConfigRead | None = None


class StudentFinanceStatus(BaseModel):
    student_id: int
    student_name: str
    plan_name: str | None = None
    subscription_status: StudentSubscriptionStatus | None = None
    credits_remaining: int | None = None
    end_date: date | None = None
    last_payment_status: PaymentStatus | None = None
    last_payment_date: datetime | None = None
    last_payment_amount: float | None = None

