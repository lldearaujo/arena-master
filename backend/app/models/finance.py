from datetime import date, datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Plan(Base):
    __tablename__ = "finance_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dojo_id: Mapped[int] = mapped_column(Integer, index=True)

    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Float)
    credits_total: Mapped[int] = mapped_column(Integer)
    validity_days: Mapped[int] = mapped_column(Integer, default=30)

    active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class StudentSubscriptionStatus(str, PyEnum):
    PENDING_PAYMENT = "pending_payment"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELED = "canceled"


class StudentSubscriptionRecurrence(str, PyEnum):
    NONE = "none"
    MANUAL_REMINDER = "manual_reminder"
    GATEWAY_RECURRING = "gateway_recurring"


class StudentSubscription(Base):
    __tablename__ = "finance_student_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dojo_id: Mapped[int] = mapped_column(Integer, index=True)

    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), index=True
    )
    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("finance_plans.id", ondelete="CASCADE"), index=True
    )

    status: Mapped[StudentSubscriptionStatus] = mapped_column(
        SAEnum(StudentSubscriptionStatus, name="finance_student_subscription_status"),
        default=StudentSubscriptionStatus.PENDING_PAYMENT,
        index=True,
    )

    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    credits_total: Mapped[int] = mapped_column(Integer)
    credits_used: Mapped[int] = mapped_column(Integer, default=0)

    recurrence_type: Mapped[StudentSubscriptionRecurrence] = mapped_column(
        SAEnum(
            StudentSubscriptionRecurrence,
            name="finance_student_subscription_recurrence",
        ),
        default=StudentSubscriptionRecurrence.NONE,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    @property
    def credits_remaining(self) -> int:
        return max(0, self.credits_total - self.credits_used)


class PaymentStatus(str, PyEnum):
    PENDING_CONFIRMATION = "pending_confirmation"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class PaymentMethod(str, PyEnum):
    PIX = "pix"


class Payment(Base):
    __tablename__ = "finance_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dojo_id: Mapped[int] = mapped_column(Integer, index=True)

    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), index=True
    )
    subscription_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("finance_student_subscriptions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    amount: Mapped[float] = mapped_column(Float)
    method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod, name="finance_payment_method"),
        default=PaymentMethod.PIX,
        index=True,
    )
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="finance_payment_status"),
        default=PaymentStatus.PENDING_CONFIRMATION,
        index=True,
    )

    payment_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    receipt_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    external_provider: Mapped[str | None] = mapped_column(String(64), nullable=True)
    external_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    checkout_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    webhook_payload: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class PixConfig(Base):
    __tablename__ = "finance_pix_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    dojo_id: Mapped[int] = mapped_column(Integer, index=True, unique=True)

    key_type: Mapped[str] = mapped_column(String(32))
    key_value: Mapped[str] = mapped_column(String(255))
    recipient_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    static_qr_image_path: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

