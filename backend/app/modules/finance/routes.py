from typing import Annotated
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_user
from app.models.user import User
from app.modules.finance import schemas, service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]
UserDep = Annotated[User, Depends(get_current_user)]


@router.get("/plans", response_model=list[schemas.PlanRead])
async def list_plans(
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.PlanRead]:
    plans = await service.list_plans(session, admin.dojo_id)
    return [schemas.PlanRead.model_validate(p) for p in plans]


@router.post(
    "/plans",
    response_model=schemas.PlanRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_plan(
    payload: schemas.PlanCreate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.PlanRead:
    plan = await service.create_plan(session, admin.dojo_id, payload)
    return schemas.PlanRead.model_validate(plan)


@router.put("/plans/{plan_id}", response_model=schemas.PlanRead)
async def update_plan(
    plan_id: int,
    payload: schemas.PlanUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.PlanRead:
    plan = await service.update_plan(session, admin.dojo_id, plan_id, payload)
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plano não encontrado",
        )
    return schemas.PlanRead.model_validate(plan)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    deleted = await service.soft_delete_plan(session, admin.dojo_id, plan_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plano não encontrado",
        )


@router.get(
    "/students/{student_id}/subscriptions",
    response_model=list[schemas.StudentSubscriptionRead],
)
async def list_student_subscriptions(
    student_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.StudentSubscriptionRead]:
    subs = await service.list_student_subscriptions(
        session, admin.dojo_id, student_id
    )
    return [
        schemas.StudentSubscriptionRead.model_validate(s) for s in subs
    ]


@router.post(
    "/students/{student_id}/subscriptions",
    response_model=schemas.StudentSubscriptionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_student_subscription(
    student_id: int,
    payload: schemas.StudentSubscriptionCreate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.StudentSubscriptionRead:
    try:
        sub = await service.create_student_subscription(
            session, admin.dojo_id, student_id, payload
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return schemas.StudentSubscriptionRead.model_validate(sub)


@router.delete(
    "/students/{student_id}/subscriptions/{subscription_id}",
    response_model=schemas.StudentSubscriptionRead,
)
async def cancel_student_subscription(
    student_id: int,
    subscription_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.StudentSubscriptionRead:
    try:
        sub = await service.cancel_student_subscription(
            session, admin.dojo_id, student_id, subscription_id
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    return schemas.StudentSubscriptionRead.model_validate(sub)


@router.get(
    "/payments",
    response_model=list[schemas.PaymentRead],
)
async def list_payments_pending_confirmation(
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.PaymentRead]:
    payments = await service.list_payments_pending_confirmation(
        session, admin.dojo_id
    )
    return [schemas.PaymentRead.model_validate(p) for p in payments]


@router.post(
    "/payments/{payment_id}/confirm",
    response_model=schemas.PaymentRead,
)
async def confirm_payment(
    payment_id: int,
    payload: schemas.PaymentConfirmRequest | None,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.PaymentRead:
    try:
        payment = await service.confirm_payment(
            session, admin.dojo_id, payment_id, payload
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return schemas.PaymentRead.model_validate(payment)


@router.post(
    "/payments/{payment_id}/reject",
    response_model=schemas.PaymentRead,
)
async def reject_payment(
    payment_id: int,
    payload: schemas.PaymentRejectRequest | None,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.PaymentRead:
    payment = await service.reject_payment(
        session, admin.dojo_id, payment_id, payload
    )
    return schemas.PaymentRead.model_validate(payment)


@router.get(
    "/pix-config",
    response_model=schemas.PixConfigRead,
)
async def get_pix_config(
    admin: AdminDep,
    session: SessionDep,
) -> schemas.PixConfigRead:
    config = await service.get_or_create_pix_config(session, admin.dojo_id)
    return schemas.PixConfigRead.model_validate(config)


@router.put(
    "/pix-config",
    response_model=schemas.PixConfigRead,
)
async def update_pix_config(
    payload: schemas.PixConfigUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.PixConfigRead:
    config = await service.update_pix_config(
        session,
        admin.dojo_id,
        payload,
    )
    return schemas.PixConfigRead.model_validate(config)


@router.get(
    "/me/plans",
    response_model=list[schemas.PlanRead],
)
async def list_my_plans(
    user: UserDep,
    session: SessionDep,
) -> list[schemas.PlanRead]:
    """Lista planos ativos do dojo do aluno (para alterar plano)."""
    if user.dojo_id is None:
        return []
    plans = await service.list_active_plans(session, user.dojo_id)
    return [schemas.PlanRead.model_validate(p) for p in plans]


@router.post(
    "/me/change-plan",
    response_model=schemas.StudentSubscriptionRead,
    status_code=status.HTTP_201_CREATED,
)
async def change_my_plan(
    payload: schemas.ChangePlanRequest,
    user: UserDep,
    session: SessionDep,
) -> schemas.StudentSubscriptionRead:
    """Altera o plano do aluno: cancela o atual e cria nova assinatura com pagamento pendente."""
    try:
        sub = await service.change_plan_for_student(
            session, user, payload.plan_id
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return schemas.StudentSubscriptionRead.model_validate(sub)


@router.get(
    "/me/summary",
    response_model=schemas.FinanceSummary,
)
async def get_my_finance_summary(
    user: UserDep,
    session: SessionDep,
) -> schemas.FinanceSummary:
    try:
        summary = await service.get_finance_summary_for_student(session, user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return summary


@router.get(
    "/students/status",
    response_model=list[schemas.StudentFinanceStatus],
)
async def list_students_finance_status(
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.StudentFinanceStatus]:
    """Lista todos os alunos do dojo com status financeiro resumido."""
    statuses = await service.list_students_finance_status(session, admin.dojo_id)
    return statuses


@router.post(
    "/me/payments",
    response_model=schemas.PaymentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_my_payment_for_subscription(
    payload: schemas.PaymentCreateForSubscription,
    user: UserDep,
    session: SessionDep,
) -> schemas.PaymentRead:
    if user.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário não está associado a um dojo",
        )
    try:
        payment = await service.create_payment_for_subscription(
            session,
            user.dojo_id,
            user,
            payload,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return schemas.PaymentRead.model_validate(payment)


@router.post(
    "/me/payments/{payment_id}/receipt",
    response_model=schemas.PaymentRead,
)
async def upload_payment_receipt(
    user: UserDep,
    session: SessionDep,
    payment_id: int,
    file: UploadFile = File(...),
) -> schemas.PaymentRead:
    if user.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário não está associado a um dojo",
        )

    # salva arquivo em diretório estático compartilhado (backend/static/receipts)
    # Estrutura: backend/
    #   app/
    #   static/
    #         receipts/
    static_dir = Path(__file__).resolve().parents[4] / "static" / "receipts"
    static_dir.mkdir(parents=True, exist_ok=True)

    file_extension = Path(file.filename or "").suffix or ".bin"
    filename = f"payment_{payment_id}{file_extension}"
    dest_path = static_dir / filename

    content = await file.read()
    dest_path.write_bytes(content)

    # caminho público (mesmo local que já é servido em /static)
    public_path = f"/static/receipts/{filename}"

    try:
        payment = await service.attach_receipt_to_payment(
            session,
            user.dojo_id,
            payment_id,
            user,
            public_path,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return schemas.PaymentRead.model_validate(payment)

