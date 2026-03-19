from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Iterable

from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import (
    Payment,
    PaymentStatus,
    PixConfig,
    Plan,
    StudentSubscription,
    StudentSubscriptionRecurrence,
    StudentSubscriptionStatus,
)
from app.models.student import Student
from app.models.user import User
from app.modules.finance import schemas


def _plans_query(dojo_id: int) -> Select[tuple[Plan]]:
    return select(Plan).where(Plan.dojo_id == dojo_id).order_by(Plan.id)


async def list_active_plans(session: AsyncSession, dojo_id: int) -> list[Plan]:
    """Lista planos ativos do dojo (para o aluno escolher ao alterar plano)."""
    result = await session.execute(
        select(Plan)
        .where(and_(Plan.dojo_id == dojo_id, Plan.active.is_(True)))
        .order_by(Plan.id)
    )
    return list(result.scalars().all())


async def list_plans(session: AsyncSession, dojo_id: int) -> list[Plan]:
    result = await session.execute(_plans_query(dojo_id))
    return list(result.scalars().all())


async def create_plan(
    session: AsyncSession,
    dojo_id: int,
    data: schemas.PlanCreate,
) -> Plan:
    plan = Plan(
        dojo_id=dojo_id,
        name=data.name,
        description=data.description,
        price=data.price,
        credits_total=data.credits_total,
        validity_days=data.validity_days,
        active=True,
    )
    session.add(plan)
    await session.commit()
    await session.refresh(plan)
    return plan


async def update_plan(
    session: AsyncSession,
    dojo_id: int,
    plan_id: int,
    data: schemas.PlanUpdate,
) -> Plan | None:
    result = await session.execute(
        _plans_query(dojo_id).where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan, field, value)

    await session.commit()
    await session.refresh(plan)
    return plan


async def soft_delete_plan(
    session: AsyncSession,
    dojo_id: int,
    plan_id: int,
) -> bool:
    result = await session.execute(
        _plans_query(dojo_id).where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        return False
    plan.active = False
    await session.commit()
    return True


async def _get_student_in_dojo(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
) -> Student | None:
    result = await session.execute(
        select(Student).where(
            and_(Student.id == student_id, Student.dojo_id == dojo_id)
        )
    )
    return result.scalar_one_or_none()


async def _get_plan_for_dojo(
    session: AsyncSession,
    dojo_id: int,
    plan_id: int,
) -> Plan | None:
    result = await session.execute(
        select(Plan).where(
            and_(Plan.id == plan_id, Plan.dojo_id == dojo_id, Plan.active.is_(True))
        )
    )
    return result.scalar_one_or_none()


async def create_student_subscription(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    data: schemas.StudentSubscriptionCreate,
) -> StudentSubscription:
    student = await _get_student_in_dojo(session, dojo_id, student_id)
    if student is None:
        raise ValueError("Aluno inválido para este dojo")

    plan = await _get_plan_for_dojo(session, dojo_id, data.plan_id)
    if plan is None:
        raise ValueError("Plano inválido para este dojo")

    # Garante que o aluno não tenha mais de um plano ativo ou pendente.
    existing_result = await session.execute(
        select(StudentSubscription).where(
            and_(
                StudentSubscription.dojo_id == dojo_id,
                StudentSubscription.student_id == student.id,
                StudentSubscription.status.in_(
                    [
                        StudentSubscriptionStatus.PENDING_PAYMENT,
                        StudentSubscriptionStatus.ACTIVE,
                    ]
                ),
            )
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        raise ValueError(
            "Aluno já possui um plano ativo ou pendente. "
            "Cancele ou expire o plano atual antes de atribuir um novo."
        )

    subscription = StudentSubscription(
        dojo_id=dojo_id,
        student_id=student.id,
        plan_id=plan.id,
        status=StudentSubscriptionStatus.PENDING_PAYMENT,
        start_date=None,
        # Data de vencimento passa a ser calculada automaticamente
        # na confirmação do pagamento, com base em payment_date
        # + validity_days do plano.
        end_date=None,
        credits_total=plan.credits_total,
        credits_used=0,
        recurrence_type=data.recurrence_type,
    )
    session.add(subscription)
    await session.flush()

    # Ao atribuir um plano ao aluno, já criamos uma cobrança/pagamento pendente
    # para que o aluno consiga enviar comprovante pelo app.
    payment = Payment(
        dojo_id=dojo_id,
        student_id=student.id,
        subscription_id=subscription.id,
        amount=plan.price,
        status=PaymentStatus.PENDING_CONFIRMATION,
    )
    session.add(payment)

    await session.commit()
    await session.refresh(subscription)
    return subscription


async def list_student_subscriptions(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
) -> list[StudentSubscription]:
    result = await session.execute(
        select(StudentSubscription)
        .where(
            and_(
                StudentSubscription.dojo_id == dojo_id,
                StudentSubscription.student_id == student_id,
            )
        )
        .order_by(StudentSubscription.id.desc())
    )
    return list(result.scalars().all())


async def change_plan_for_student(
    session: AsyncSession,
    user: User,
    plan_id: int,
) -> StudentSubscription:
    """
    Altera o plano do aluno (usuário logado). Cancela a assinatura ativa/pendente
    e cria uma nova para o plano escolhido, com pagamento pendente.
    """
    if user.role != "aluno" or user.dojo_id is None:
        raise ValueError("Somente alunos podem alterar o próprio plano")
    dojo_id = user.dojo_id

    result = await session.execute(
        select(Student).where(
            and_(
                Student.user_id == user.id,
                Student.dojo_id == dojo_id,
            )
        )
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise ValueError("Aluno não encontrado para este usuário")

    # Cancela assinatura ativa ou pendente, se existir
    existing_result = await session.execute(
        select(StudentSubscription).where(
            and_(
                StudentSubscription.dojo_id == dojo_id,
                StudentSubscription.student_id == student.id,
                StudentSubscription.status.in_(
                    [
                        StudentSubscriptionStatus.PENDING_PAYMENT,
                        StudentSubscriptionStatus.ACTIVE,
                    ]
                ),
            )
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        await cancel_student_subscription(
            session, dojo_id, student.id, existing.id
        )

    # Cria nova assinatura para o plano escolhido
    return await create_student_subscription(
        session,
        dojo_id,
        student.id,
        schemas.StudentSubscriptionCreate(
            plan_id=plan_id,
            recurrence_type=StudentSubscriptionRecurrence.NONE,
        ),
    )


async def cancel_student_subscription(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    subscription_id: int,
) -> StudentSubscription:
    result = await session.execute(
        select(StudentSubscription).where(
            and_(
                StudentSubscription.id == subscription_id,
                StudentSubscription.dojo_id == dojo_id,
                StudentSubscription.student_id == student_id,
            )
        )
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        raise ValueError("Assinatura não encontrada para este aluno")

    # Marca assinatura como cancelada.
    sub.status = StudentSubscriptionStatus.CANCELED

    # Cancela também pagamentos pendentes vinculados a essa assinatura.
    pay_result = await session.execute(
        select(Payment).where(
            and_(
                Payment.subscription_id == sub.id,
                Payment.dojo_id == dojo_id,
                Payment.status == PaymentStatus.PENDING_CONFIRMATION,
            )
        )
    )
    for p in pay_result.scalars().all():
        p.status = PaymentStatus.REJECTED
        p.notes = (p.notes or "") + "\nPagamento cancelado junto com o plano."

    await session.commit()
    await session.refresh(sub)
    return sub


async def get_active_subscription_for_student(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    today: date | None = None,
) -> StudentSubscription | None:
    today = today or datetime.now(UTC).date()
    result = await session.execute(
        select(StudentSubscription)
        .where(
            and_(
                StudentSubscription.dojo_id == dojo_id,
                StudentSubscription.student_id == student_id,
                StudentSubscription.status == StudentSubscriptionStatus.ACTIVE,
                StudentSubscription.start_date <= today,
                StudentSubscription.end_date >= today,
                StudentSubscription.credits_used < StudentSubscription.credits_total,
            )
        )
        .order_by(StudentSubscription.start_date)
    )
    return result.scalar_one_or_none()


async def create_payment_for_subscription(
    session: AsyncSession,
    dojo_id: int,
    student: User,
    data: schemas.PaymentCreateForSubscription,
) -> Payment:
    # student aqui é o usuário logado (aluno); precisamos encontrar Student
    if student.role != "aluno" or student.dojo_id != dojo_id:
        raise ValueError("Somente alunos podem criar pagamentos próprios")

    # encontra Student pelo user_id
    result = await session.execute(
        select(Student).where(
            and_(
                Student.user_id == student.id,
                Student.dojo_id == dojo_id,
            )
        )
    )
    student_model = result.scalar_one_or_none()
    if student_model is None:
        raise ValueError("Aluno não encontrado para este usuário")

    subscription = await session.get(StudentSubscription, data.subscription_id)
    if (
        subscription is None
        or subscription.dojo_id != dojo_id
        or subscription.student_id != student_model.id
    ):
        raise ValueError("Assinatura inválida para este aluno")

    payment = Payment(
        dojo_id=dojo_id,
        student_id=student_model.id,
        subscription_id=subscription.id,
        amount=data.amount,
        status=PaymentStatus.PENDING_CONFIRMATION,
    )
    session.add(payment)
    await session.commit()
    await session.refresh(payment)
    return payment


async def attach_receipt_to_payment(
    session: AsyncSession,
    dojo_id: int,
    payment_id: int,
    student_user: User,
    receipt_path: str,
) -> Payment:
    payment = await session.get(Payment, payment_id)
    if payment is None or payment.dojo_id != dojo_id:
        raise ValueError("Pagamento não encontrado")

    # aluno só pode mexer nos próprios pagamentos
    result = await session.execute(
        select(Student).where(
            and_(
                Student.id == payment.student_id,
                Student.dojo_id == dojo_id,
                Student.user_id == student_user.id,
            )
        )
    )
    if result.scalar_one_or_none() is None:
        raise ValueError("Você não tem permissão para enviar comprovante para este pagamento")

    payment.receipt_path = receipt_path
    payment.payment_date = payment.payment_date or datetime.now(UTC)
    payment.status = PaymentStatus.PENDING_CONFIRMATION
    await session.commit()
    await session.refresh(payment)
    return payment


async def list_payments_pending_confirmation(
    session: AsyncSession,
    dojo_id: int,
) -> list[Payment]:
    # Lista apenas pagamentos pendentes ligados a assinaturas
    # que ainda não foram canceladas.
    # Retorna Payment com o nome do aluno (para exibir na listagem de pendências).
    result = await session.execute(
        select(Payment, Student.name)
        .join(
            StudentSubscription,
            Payment.subscription_id == StudentSubscription.id,
        )
        .join(Student, Payment.student_id == Student.id)
        .where(
            and_(
                Payment.dojo_id == dojo_id,
                Payment.status == PaymentStatus.PENDING_CONFIRMATION,
                StudentSubscription.status != StudentSubscriptionStatus.CANCELED,
                Student.dojo_id == dojo_id,
            )
        )
        .order_by(Payment.id.desc())
    )

    payments: list[Payment] = []
    for payment, student_name in result.all():
        # A query retorna um campo extra que não existe no ORM Payment.
        # Para reaproveitar PaymentRead.model_validate(), anexamos dinamicamente
        # a propriedade student_name no objeto.
        setattr(payment, "student_name", student_name)
        payments.append(payment)

    return payments


async def confirm_payment(
    session: AsyncSession,
    dojo_id: int,
    payment_id: int,
    data: schemas.PaymentConfirmRequest | None = None,
) -> Payment:
    payment = await session.get(Payment, payment_id)
    if payment is None or payment.dojo_id != dojo_id:
        raise ValueError("Pagamento não encontrado")

    if payment.status == PaymentStatus.CONFIRMED:
        return payment

    subscription: StudentSubscription | None = None
    if payment.subscription_id is not None:
        subscription = await session.get(StudentSubscription, payment.subscription_id)

    if subscription is None:
        raise ValueError("Assinatura vinculada ao pagamento não encontrada")

    now = datetime.now(UTC)
    payment.status = PaymentStatus.CONFIRMED
    payment.confirmed_at = now
    if data and data.payment_date is not None:
        payment.payment_date = data.payment_date
    elif payment.payment_date is None:
        payment.payment_date = now

    # ativa assinatura e define validade/créditos
    start = payment.payment_date.date()

    # Busca o plano para obter os dias de validade.
    from sqlalchemy import select
    from app.models.finance import Plan

    result = await session.execute(
        select(Plan).where(
            Plan.id == subscription.plan_id,
            Plan.dojo_id == dojo_id,
        )
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise ValueError("Plano da assinatura não encontrado")

    # Calcula data de vencimento automaticamente:
    # início do ciclo (data do pagamento) + validity_days do plano.
    end = start + timedelta(days=plan.validity_days)

    subscription.status = StudentSubscriptionStatus.ACTIVE
    subscription.start_date = start
    subscription.end_date = end
    subscription.credits_used = 0

    await session.commit()
    await session.refresh(payment)
    return payment


async def reject_payment(
    session: AsyncSession,
    dojo_id: int,
    payment_id: int,
    data: schemas.PaymentRejectRequest | None = None,
) -> Payment:
    payment = await session.get(Payment, payment_id)
    if payment is None or payment.dojo_id != dojo_id:
        raise ValueError("Pagamento não encontrado")

    payment.status = PaymentStatus.REJECTED
    if data and data.reason:
        payment.notes = (payment.notes or "") + f"\nRejeitado: {data.reason}"

    await session.commit()
    await session.refresh(payment)
    return payment


async def get_or_create_pix_config(
    session: AsyncSession,
    dojo_id: int,
) -> PixConfig:
    result = await session.execute(
        select(PixConfig).where(PixConfig.dojo_id == dojo_id)
    )
    config = result.scalar_one_or_none()
    if config is not None:
        return config

    config = PixConfig(
        dojo_id=dojo_id,
        key_type="chave_aleatoria",
        key_value="",
    )
    session.add(config)
    await session.commit()
    await session.refresh(config)
    return config


async def update_pix_config(
    session: AsyncSession,
    dojo_id: int,
    data: schemas.PixConfigUpdate,
) -> PixConfig:
    config = await get_or_create_pix_config(session, dojo_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    await session.commit()
    await session.refresh(config)
    return config


async def get_finance_summary_for_student(
    session: AsyncSession,
    user: User,
) -> schemas.FinanceSummary:
    if user.role != "aluno" or user.dojo_id is None:
        raise ValueError("Apenas alunos podem acessar o resumo financeiro próprio")

    dojo_id = user.dojo_id

    # encontra Student vinculado ao user
    result = await session.execute(
        select(Student).where(
            and_(
                Student.user_id == user.id,
                Student.dojo_id == dojo_id,
            )
        )
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise ValueError("Aluno não encontrado para este usuário")

    subs = await list_student_subscriptions(session, dojo_id, student.id)

    # monta mapa para nome do plano
    plan_ids = list({s.plan_id for s in subs})
    plans_by_id: dict[int, Plan] = {}
    if plan_ids:
        plan_result = await session.execute(
            select(Plan).where(Plan.id.in_(plan_ids))
        )
        for p in plan_result.scalars().all():
            plans_by_id[p.id] = p

    def to_sub_summary(s: StudentSubscription) -> schemas.FinanceSummarySubscription:
        plan = plans_by_id.get(s.plan_id)
        return schemas.FinanceSummarySubscription(
            id=s.id,
            plan_id=s.plan_id,
            plan_name=plan.name if plan else "Plano",
            status=s.status,
            start_date=s.start_date,
            end_date=s.end_date,
            credits_total=s.credits_total,
            credits_used=s.credits_used,
            credits_remaining=max(0, s.credits_total - s.credits_used),
        )

    subs_summaries = [to_sub_summary(s) for s in subs]

    subs_by_id: dict[int, StudentSubscription] = {s.id: s for s in subs}

    today = datetime.now(UTC).date()
    active_sub = await get_active_subscription_for_student(
        session, dojo_id, student.id, today
    )
    active_summary = to_sub_summary(active_sub) if active_sub else None

    # pagamentos do aluno (ignorando pagamentos de planos cancelados)
    pay_result = await session.execute(
        select(Payment)
        .join(
            StudentSubscription,
            Payment.subscription_id == StudentSubscription.id,
        )
        .where(
            and_(
                Payment.dojo_id == dojo_id,
                Payment.student_id == student.id,
                StudentSubscription.status != StudentSubscriptionStatus.CANCELED,
            )
        )
        .order_by(Payment.id.desc())
    )
    payments = list(pay_result.scalars().all())
    payment_summaries = []
    for p in payments:
        plan_name: str | None = None
        end_date: date | None = None
        if p.subscription_id is not None:
            sub = subs_by_id.get(p.subscription_id)
            if sub is not None:
                end_date = sub.end_date
                plan = plans_by_id.get(sub.plan_id)
                if plan is not None:
                    plan_name = plan.name
        payment_summaries.append(
            schemas.FinancePaymentSummary(
                id=p.id,
                amount=p.amount,
                status=p.status,
                created_at=p.created_at,
                payment_date=p.payment_date,
                confirmed_at=p.confirmed_at,
                plan_name=plan_name,
                end_date=end_date,
                receipt_path=p.receipt_path,
            )
        )

    # pix config
    pix_config: PixConfig | None
    result = await session.execute(
        select(PixConfig).where(PixConfig.dojo_id == dojo_id)
    )
    pix_config = result.scalar_one_or_none()
    pix_schema = (
        schemas.PixConfigRead.model_validate(pix_config) if pix_config else None
    )

    return schemas.FinanceSummary(
        active_subscription=active_summary,
        subscriptions=subs_summaries,
        payments=payment_summaries,
        pix_config=pix_schema,
    )


async def consume_credit_for_checkin(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    when: datetime | None = None,
) -> None:
    """Consome 1 crédito da assinatura ativa do aluno.

    Lança ValueError se não houver créditos válidos.
    """
    when = when or datetime.now(UTC)
    active_sub = await get_active_subscription_for_student(
        session, dojo_id, student_id, when.date()
    )
    if active_sub is None:
        raise ValueError(
            "Aluno não possui créditos ativos ou plano vigente para realizar check-in."
        )

    # incrementa créditos usados
    active_sub.credits_used += 1
    await session.flush()


async def refund_credit_for_checkin(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    when: datetime | None = None,
) -> None:
    """Devolve 1 crédito à assinatura ativa do aluno na data do check-in.

    Usado quando o professor marca o aluno como ausente. Busca a assinatura
    ativa naquela data com pelo menos 1 crédito usado (para devolver).
    Não lança erro se não houver assinatura ou créditos usados forem 0.
    """
    when = when or datetime.now(UTC)
    target_date = when.date()
    result = await session.execute(
        select(StudentSubscription)
        .where(
            and_(
                StudentSubscription.dojo_id == dojo_id,
                StudentSubscription.student_id == student_id,
                StudentSubscription.status == StudentSubscriptionStatus.ACTIVE,
                StudentSubscription.start_date <= target_date,
                StudentSubscription.end_date >= target_date,
                StudentSubscription.credits_used > 0,
            )
        )
        .order_by(StudentSubscription.start_date.desc())
    )
    active_sub = result.scalar_one_or_none()
    if active_sub is None:
        return
    active_sub.credits_used -= 1
    await session.flush()


async def list_students_finance_status(
    session: AsyncSession,
    dojo_id: int,
) -> list[schemas.StudentFinanceStatus]:
    """Lista todos os alunos do dojo com status financeiro resumido."""
    # alunos do dojo
    result = await session.execute(
        select(Student).where(Student.dojo_id == dojo_id).order_by(Student.name)
    )
    students = list(result.scalars().all())
    if not students:
        return []

    student_ids = [s.id for s in students]

    # assinaturas dos alunos
    subs_result = await session.execute(
        select(StudentSubscription)
        .where(
            and_(
                StudentSubscription.dojo_id == dojo_id,
                StudentSubscription.student_id.in_(student_ids),
            )
        )
        .order_by(StudentSubscription.id.desc())
    )
    subs = list(subs_result.scalars().all())

    # pega apenas a assinatura mais recente por aluno
    latest_sub_by_student: dict[int, StudentSubscription] = {}
    for sub in subs:
        if sub.student_id not in latest_sub_by_student:
            latest_sub_by_student[sub.student_id] = sub

    # planos para montar nome
    plan_ids = list({s.plan_id for s in subs})
    plans_by_id: dict[int, Plan] = {}
    if plan_ids:
        plans_result = await session.execute(select(Plan).where(Plan.id.in_(plan_ids)))
        for p in plans_result.scalars().all():
            plans_by_id[p.id] = p

    # pagamentos: último pagamento por aluno
    pay_result = await session.execute(
        select(Payment)
        .where(
            and_(
                Payment.dojo_id == dojo_id,
                Payment.student_id.in_(student_ids),
            )
        )
        .order_by(Payment.id.desc())
    )
    payments = list(pay_result.scalars().all())
    latest_payment_by_student: dict[int, Payment] = {}
    for p in payments:
        if p.student_id not in latest_payment_by_student:
            latest_payment_by_student[p.student_id] = p

    statuses: list[schemas.StudentFinanceStatus] = []
    for student in students:
        sub = latest_sub_by_student.get(student.id)
        plan = plans_by_id.get(sub.plan_id) if sub else None
        pay = latest_payment_by_student.get(student.id)

        statuses.append(
            schemas.StudentFinanceStatus(
                student_id=student.id,
                student_name=student.name,
                plan_name=plan.name if plan else None,
                subscription_status=sub.status if sub else None,
                credits_remaining=(
                    max(0, sub.credits_total - sub.credits_used) if sub else None
                ),
                end_date=sub.end_date if sub else None,
                last_payment_status=pay.status if pay else None,
                last_payment_date=pay.payment_date if pay else None,
                last_payment_amount=pay.amount if pay else None,
            )
        )

    return statuses

