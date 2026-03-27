from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_user
from app.models.dojo import Dojo
from app.models.student import Student
from app.models.user import User
from app.modules.seminars import schemas, service
from app.modules.finance import service as finance_service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[User, Depends(get_current_user)]
AdminDep = Annotated[User, Depends(get_current_admin)]

async def _enrich_registration_student_name(
    session: AsyncSession, reg_obj
) -> schemas.SeminarRegistrationRead:
    payload = schemas.SeminarRegistrationRead.model_validate(reg_obj).model_dump()
    sid = getattr(reg_obj, "student_id", None)
    if sid:
        res = await session.execute(select(Student.name).where(Student.id == sid).limit(1))
        payload["student_name"] = res.scalar_one_or_none()
    else:
        payload["student_name"] = None
    return schemas.SeminarRegistrationRead.model_validate(payload)

async def _enrich_registrations_student_names(
    session: AsyncSession, regs: list
) -> list[schemas.SeminarRegistrationRead]:
    ids = sorted({int(r.student_id) for r in regs if getattr(r, "student_id", None)})
    name_by_id: dict[int, str] = {}
    if ids:
        res = await session.execute(select(Student.id, Student.name).where(Student.id.in_(ids)))
        name_by_id = {int(i): str(n) for (i, n) in res.all()}
    out: list[schemas.SeminarRegistrationRead] = []
    for r in regs:
        payload = schemas.SeminarRegistrationRead.model_validate(r).model_dump()
        payload["student_name"] = name_by_id.get(int(r.student_id)) if getattr(r, "student_id", None) else None
        out.append(schemas.SeminarRegistrationRead.model_validate(payload))
    return out

def _assert_student_can_view(user: User, seminar) -> None:
    """Regras de visibilidade para aluno.

    - public: qualquer aluno pode ver
    - internal: apenas alunos do dojo organizador
    """
    if not getattr(seminar, "is_published", False):
        raise HTTPException(status_code=403, detail="Seminário não publicado")
    if getattr(seminar, "visibility", "internal") != "public":
        if not user.dojo_id or seminar.organizer_dojo_id != user.dojo_id:
            raise HTTPException(status_code=403, detail="Sem permissão")


@router.get("/", response_model=list[schemas.SeminarRead])
async def list_seminars(user: UserDep, session: SessionDep) -> list[schemas.SeminarRead]:
    items = await service.list_seminars(session, user)
    dojo_ids = sorted({s.organizer_dojo_id for s in items if getattr(s, "organizer_dojo_id", None)})
    dojo_name_by_id: dict[int, str] = {}
    if dojo_ids:
        res = await session.execute(select(Dojo.id, Dojo.name).where(Dojo.id.in_(dojo_ids)))
        dojo_name_by_id = {int(i): str(n) for (i, n) in res.all()}

    out: list[schemas.SeminarRead] = []
    for s in items:
        payload = schemas.SeminarRead.model_validate(s).model_dump()
        payload["organizer_dojo_name"] = dojo_name_by_id.get(int(s.organizer_dojo_id)) if s.organizer_dojo_id else None
        out.append(schemas.SeminarRead.model_validate(payload))
    return out


@router.get("/public/enroll/{seminar_id}/summary", response_model=schemas.SeminarPublicSummary)
async def public_summary(session: SessionDep, seminar_id: int) -> schemas.SeminarPublicSummary:
    data = await service.get_public_summary(session, seminar_id)
    seminar = data["seminar"]
    pr = data["pricing"]
    lot = pr["lot"]

    dojo_name = None
    try:
        res = await session.execute(select(Dojo.name).where(Dojo.id == seminar.organizer_dojo_id).limit(1))
        dojo_name = res.scalar_one_or_none()
    except Exception:
        dojo_name = None

    pix = None
    try:
        pix_obj = await finance_service.get_or_create_pix_config(session, seminar.organizer_dojo_id)
        # pydantic read model em finance é desnecessário aqui; retornamos dict simples (web mostra campos conhecidos)
        pix = {
            "key_type": pix_obj.key_type,
            "key_value": pix_obj.key_value,
            "recipient_name": pix_obj.recipient_name,
            "bank_name": pix_obj.bank_name,
            "instructions": pix_obj.instructions,
            "static_qr_image_path": pix_obj.static_qr_image_path,
        }
    except Exception:
        pix = None

    return schemas.SeminarPublicSummary(
        seminar=schemas.SeminarRead.model_validate(
            {**schemas.SeminarRead.model_validate(seminar).model_dump(), "organizer_dojo_name": dojo_name}
        ),
        pricing=schemas.SeminarPricingRead(
            seminar_id=pr["seminar_id"],
            lot=schemas.SeminarLotRead.model_validate(lot) if lot else None,
            current_price_amount=pr["current_price_amount"],
            seats_total=pr["seats_total"],
            seats_filled=pr["seats_filled"],
            percent_filled=pr["percent_filled"],
            next_lot_starts_at=pr["next_lot_starts_at"],
        ),
        pix_config=pix,
    )


@router.post(
    "/public/enroll/{seminar_id}",
    response_model=schemas.SeminarPublicEnrollResponse,
    status_code=status.HTTP_201_CREATED,
)
async def public_enroll(
    session: SessionDep, seminar_id: int, payload: schemas.SeminarPublicEnrollRequest
) -> schemas.SeminarPublicEnrollResponse:
    reg = await service.create_public_guest_registration(session, seminar_id, payload)
    return schemas.SeminarPublicEnrollResponse(
        registration=await _enrich_registration_student_name(session, reg)
    )


@router.post(
    "/public/registrations/{public_code}/payment-receipt",
    response_model=schemas.SeminarRegistrationRead,
)
async def public_upload_receipt(
    session: SessionDep, public_code: str, file: UploadFile = File(...)
) -> schemas.SeminarRegistrationRead:
    reg = await service.attach_payment_receipt_by_public_code(session, public_code, file)
    return await _enrich_registration_student_name(session, reg)


@router.get("/{seminar_id}", response_model=schemas.SeminarRead)
async def get_seminar(user: UserDep, session: SessionDep, seminar_id: int) -> schemas.SeminarRead:
    s = await service.get_seminar(session, seminar_id)
    if user.role == "aluno":
        _assert_student_can_view(user, s)
    dojo_name = None
    try:
        res = await session.execute(select(Dojo.name).where(Dojo.id == s.organizer_dojo_id).limit(1))
        dojo_name = res.scalar_one_or_none()
    except Exception:
        dojo_name = None
    return schemas.SeminarRead.model_validate({**schemas.SeminarRead.model_validate(s).model_dump(), "organizer_dojo_name": dojo_name})


@router.post("/", response_model=schemas.SeminarRead, status_code=status.HTTP_201_CREATED)
async def create_seminar(
    admin: AdminDep, session: SessionDep, payload: schemas.SeminarCreate
) -> schemas.SeminarRead:
    s = await service.create_seminar(session, admin, payload)
    return schemas.SeminarRead.model_validate(s)


@router.patch("/{seminar_id}", response_model=schemas.SeminarRead)
async def update_seminar(
    admin: AdminDep, session: SessionDep, seminar_id: int, payload: schemas.SeminarUpdate
) -> schemas.SeminarRead:
    s = await service.update_seminar(session, admin, seminar_id, payload)
    return schemas.SeminarRead.model_validate(s)


@router.post("/{seminar_id}/publish", response_model=schemas.SeminarRead)
async def publish_seminar(admin: AdminDep, session: SessionDep, seminar_id: int) -> schemas.SeminarRead:
    s = await service.set_published(session, admin, seminar_id, True)
    return schemas.SeminarRead.model_validate(s)


@router.post("/{seminar_id}/unpublish", response_model=schemas.SeminarRead)
async def unpublish_seminar(admin: AdminDep, session: SessionDep, seminar_id: int) -> schemas.SeminarRead:
    s = await service.set_published(session, admin, seminar_id, False)
    return schemas.SeminarRead.model_validate(s)


@router.post("/{seminar_id}/banner", response_model=schemas.SeminarRead)
async def upload_seminar_banner(
    admin: AdminDep,
    session: SessionDep,
    seminar_id: int,
    file: UploadFile = File(...),
) -> schemas.SeminarRead:
    s = await service.upload_banner(session, admin, seminar_id, file)
    return schemas.SeminarRead.model_validate(s)


@router.get("/{seminar_id}/lots", response_model=list[schemas.SeminarLotRead])
async def list_lots(user: UserDep, session: SessionDep, seminar_id: int) -> list[schemas.SeminarLotRead]:
    if user.role == "aluno":
        s = await service.get_seminar(session, seminar_id)
        _assert_student_can_view(user, s)
    lots = await service.list_lots(session, seminar_id)
    return [schemas.SeminarLotRead.model_validate(l) for l in lots]


@router.post("/{seminar_id}/lots", response_model=schemas.SeminarLotRead, status_code=status.HTTP_201_CREATED)
async def add_lot(
    admin: AdminDep,
    session: SessionDep,
    seminar_id: int,
    payload: schemas.SeminarLotCreate,
) -> schemas.SeminarLotRead:
    lot = await service.add_lot(session, admin, seminar_id, payload)
    return schemas.SeminarLotRead.model_validate(lot)


@router.delete("/{seminar_id}/lots/{lot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lot(admin: AdminDep, session: SessionDep, seminar_id: int, lot_id: int) -> None:
    await service.delete_lot(session, admin, seminar_id, lot_id)


@router.get("/{seminar_id}/schedule-items", response_model=list[schemas.SeminarScheduleItemRead])
async def list_schedule_items(
    user: UserDep, session: SessionDep, seminar_id: int
) -> list[schemas.SeminarScheduleItemRead]:
    if user.role == "aluno":
        s = await service.get_seminar(session, seminar_id)
        _assert_student_can_view(user, s)
    items = await service.list_schedule_items(session, seminar_id)
    return [schemas.SeminarScheduleItemRead.model_validate(i) for i in items]


@router.post(
    "/{seminar_id}/schedule-items",
    response_model=schemas.SeminarScheduleItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_schedule_item(
    admin: AdminDep,
    session: SessionDep,
    seminar_id: int,
    payload: schemas.SeminarScheduleItemCreate,
) -> schemas.SeminarScheduleItemRead:
    item = await service.add_schedule_item(session, admin, seminar_id, payload)
    return schemas.SeminarScheduleItemRead.model_validate(item)


@router.delete("/{seminar_id}/schedule-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule_item(
    admin: AdminDep, session: SessionDep, seminar_id: int, item_id: int
) -> None:
    await service.delete_schedule_item(session, admin, seminar_id, item_id)


@router.get("/{seminar_id}/pricing", response_model=schemas.SeminarPricingRead)
async def pricing(user: UserDep, session: SessionDep, seminar_id: int) -> schemas.SeminarPricingRead:
    seminar = await service.get_seminar(session, seminar_id)
    if user.role == "aluno":
        _assert_student_can_view(user, seminar)
    pr = await service.pricing(session, seminar)
    lot = pr["lot"]
    return schemas.SeminarPricingRead(
        seminar_id=pr["seminar_id"],
        lot=schemas.SeminarLotRead.model_validate(lot) if lot else None,
        current_price_amount=pr["current_price_amount"],
        seats_total=pr["seats_total"],
        seats_filled=pr["seats_filled"],
        percent_filled=pr["percent_filled"],
        next_lot_starts_at=pr["next_lot_starts_at"],
    )


@router.post(
    "/{seminar_id}/registrations",
    response_model=schemas.SeminarRegistrationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_registration(
    user: UserDep,
    session: SessionDep,
    seminar_id: int,
    payload: schemas.SeminarRegistrationCreate,
) -> schemas.SeminarRegistrationRead:
    reg = await service.create_registration(session, user, seminar_id, payload)
    return await _enrich_registration_student_name(session, reg)


@router.get("/{seminar_id}/me/registrations", response_model=list[schemas.SeminarRegistrationRead])
async def my_registrations(
    user: UserDep, session: SessionDep, seminar_id: int
) -> list[schemas.SeminarRegistrationRead]:
    if user.role == "aluno":
        s = await service.get_seminar(session, seminar_id)
        _assert_student_can_view(user, s)
    regs = await service.list_my_registrations(session, user, seminar_id)
    return await _enrich_registrations_student_names(session, regs)


@router.get("/{seminar_id}/registrations", response_model=list[schemas.SeminarRegistrationRead])
async def list_registrations_admin(
    admin: AdminDep,
    session: SessionDep,
    seminar_id: int,
    payment_status: str | None = Query(None),
) -> list[schemas.SeminarRegistrationRead]:
    regs = await service.list_registrations_admin(session, admin, seminar_id, payment_status)
    return await _enrich_registrations_student_names(session, regs)


@router.post(
    "/{seminar_id}/registrations/{registration_id}/payment-receipt",
    response_model=schemas.SeminarRegistrationRead,
)
async def upload_payment_receipt(
    user: UserDep,
    session: SessionDep,
    seminar_id: int,
    registration_id: int,
    file: UploadFile = File(...),
) -> schemas.SeminarRegistrationRead:
    reg = await service.attach_payment_receipt(session, user, seminar_id, registration_id, file)
    return await _enrich_registration_student_name(session, reg)


@router.post(
    "/{seminar_id}/registrations/{registration_id}/confirm-payment",
    response_model=schemas.SeminarRegistrationRead,
)
async def confirm_payment(
    admin: AdminDep, session: SessionDep, seminar_id: int, registration_id: int
) -> schemas.SeminarRegistrationRead:
    reg = await service.confirm_payment(session, admin, seminar_id, registration_id)
    return await _enrich_registration_student_name(session, reg)


@router.post(
    "/{seminar_id}/registrations/{registration_id}/reject-payment",
    response_model=schemas.SeminarRegistrationRead,
)
async def reject_payment(
    admin: AdminDep,
    session: SessionDep,
    seminar_id: int,
    registration_id: int,
    notes: str | None = Body(None),
) -> schemas.SeminarRegistrationRead:
    reg = await service.reject_payment(session, admin, seminar_id, registration_id, notes)
    return await _enrich_registration_student_name(session, reg)


@router.get(
    "/{seminar_id}/registrations/{registration_id}/ticket",
    response_model=schemas.SeminarTicketRead,
)
async def get_ticket(
    user: UserDep, session: SessionDep, seminar_id: int, registration_id: int
) -> schemas.SeminarTicketRead:
    if user.role == "aluno":
        s = await service.get_seminar(session, seminar_id)
        _assert_student_can_view(user, s)
    reg, token, exp = await service.get_ticket(session, user, seminar_id, registration_id)
    return schemas.SeminarTicketRead(
        registration_id=reg.id,
        seminar_id=seminar_id,
        token=token,
        public_code=reg.public_code,
        expires_at=exp,
    )


@router.post("/{seminar_id}/check-in", response_model=schemas.SeminarAttendanceRead)
async def check_in(
    admin: AdminDep,
    session: SessionDep,
    seminar_id: int,
    payload: schemas.SeminarCheckInRequest,
) -> schemas.SeminarAttendanceRead:
    att = await service.check_in(session, admin, seminar_id, payload.token, payload.public_code)
    return schemas.SeminarAttendanceRead.model_validate(att)


@router.get("/{seminar_id}/attendance", response_model=list[schemas.SeminarAttendanceRead])
async def attendance(
    admin: AdminDep, session: SessionDep, seminar_id: int
) -> list[schemas.SeminarAttendanceRead]:
    rows = await service.list_attendance(session, admin, seminar_id)
    return [schemas.SeminarAttendanceRead.model_validate(a) for a in rows]

