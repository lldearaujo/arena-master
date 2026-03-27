from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class SeminarBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    banner_url: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    location_city: str | None = Field(None, max_length=128)
    location_state: str | None = Field(None, max_length=32)
    location_text: str | None = None
    speaker_name: str | None = None
    speaker_bio: str | None = None
    speaker_photo_url: str | None = None
    speaker_achievements: str | None = None
    capacity: int | None = Field(None, ge=0)
    is_published: bool = False
    visibility: str = Field(default="internal", pattern="^(internal|public)$")


class SeminarCreate(SeminarBase):
    organizer_dojo_id: int


class SeminarUpdate(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=255)
    description: str | None = None
    banner_url: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    location_city: str | None = Field(None, max_length=128)
    location_state: str | None = Field(None, max_length=32)
    location_text: str | None = None
    speaker_name: str | None = None
    speaker_bio: str | None = None
    speaker_photo_url: str | None = None
    speaker_achievements: str | None = None
    capacity: int | None = Field(None, ge=0)
    is_published: bool | None = None
    visibility: str | None = Field(default=None, pattern="^(internal|public)$")


class SeminarRead(SeminarBase):
    id: int
    organizer_dojo_id: int
    organizer_dojo_name: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SeminarLotBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    price_amount: float = Field(0.0, ge=0.0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    order: int = 0


class SeminarLotCreate(SeminarLotBase):
    pass


class SeminarLotRead(SeminarLotBase):
    id: int
    seminar_id: int

    class Config:
        from_attributes = True


class SeminarScheduleItemBase(BaseModel):
    kind: str = Field("other", max_length=32)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    title: str = Field(..., min_length=1, max_length=255)
    notes: str | None = None


class SeminarScheduleItemCreate(SeminarScheduleItemBase):
    pass


class SeminarScheduleItemRead(SeminarScheduleItemBase):
    id: int
    seminar_id: int

    class Config:
        from_attributes = True


class SeminarPricingRead(BaseModel):
    seminar_id: int
    lot: SeminarLotRead | None = None
    current_price_amount: float = 0.0
    seats_total: int | None = None
    seats_filled: int = 0
    percent_filled: int = 0
    next_lot_starts_at: datetime | None = None


class SeminarRegistrationCreate(BaseModel):
    student_id: int | None = None
    guest_full_name: str | None = Field(None, min_length=2, max_length=255)
    guest_email: EmailStr | None = None
    guest_phone: str | None = Field(None, max_length=64)


class SeminarRegistrationRead(BaseModel):
    id: int
    seminar_id: int
    buyer_user_id: int | None = None
    student_id: int | None = None
    student_name: str | None = None
    guest_full_name: str | None = None
    guest_email: EmailStr | None = None
    guest_phone: str | None = None
    status: str
    payment_status: str
    payment_receipt_path: str | None = None
    payment_notes: str | None = None
    payment_confirmed_at: datetime | None = None
    paid_amount: float | None = None
    public_code: str
    created_at: datetime

    class Config:
        from_attributes = True


class SeminarPublicSummary(BaseModel):
    seminar: SeminarRead
    pricing: SeminarPricingRead
    pix_config: dict | None = None


class SeminarPublicEnrollRequest(BaseModel):
    guest_full_name: str = Field(..., min_length=2, max_length=255)
    guest_email: EmailStr
    guest_phone: str | None = Field(None, max_length=64)


class SeminarPublicEnrollResponse(BaseModel):
    registration: SeminarRegistrationRead


class SeminarTicketRead(BaseModel):
    registration_id: int
    seminar_id: int
    token: str
    public_code: str
    expires_at: datetime


class SeminarCheckInRequest(BaseModel):
    token: str | None = None
    public_code: str | None = None


class SeminarAttendanceRead(BaseModel):
    id: int
    seminar_id: int
    registration_id: int
    checked_in_at: datetime
    checked_in_by_user_id: int | None = None

    class Config:
        from_attributes = True

