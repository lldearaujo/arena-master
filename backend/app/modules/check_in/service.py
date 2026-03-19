from datetime import UTC, date, datetime

from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.check_in import CheckIn
from app.models.student import Student
from app.models.student_guardian import StudentGuardian
from app.models.turma import Turma
from app.models.turma_enrollment import TurmaEnrollment
from app.models.user import User
from app.modules.check_in.schemas import CheckInCreate, CheckInFilter
from app.modules.finance.service import consume_credit_for_checkin, refund_credit_for_checkin


def _checkins_query(dojo_id: int) -> Select[tuple[CheckIn]]:
    return select(CheckIn).where(CheckIn.dojo_id == dojo_id).order_by(
        CheckIn.occurred_at.desc()
    )


def _day_abbrev_now() -> str:
    """Abreviação do dia atual (seg, ter, ...) em horário local."""
    abbrevs = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]
    return abbrevs[datetime.now().weekday()]


def _check_checkin_allowed_until_start(turma: Turma) -> None:
    """
    Verifica se ainda é possível fazer check-in: apenas no dia da turma
    e até o horário de início (inclusive). Após o início, bloqueia.
    """
    now_local = datetime.now()
    today_abbrev = _day_abbrev_now()
    turma_days = [d.strip() for d in turma.day_of_week.split(",")]
    if today_abbrev not in turma_days:
        raise ValueError(
            "Check-in só é permitido no dia da turma. Hoje não é dia desta turma."
        )
    if now_local.time() > turma.start_time:
        raise ValueError(
            "Não é mais possível fazer check-in após o horário de início da turma."
        )


async def _get_turma_for_dojo(
    session: AsyncSession,
    dojo_id: int,
    turma_id: int,
) -> Turma | None:
    result = await session.execute(
        select(Turma).where(
            and_(Turma.id == turma_id, Turma.dojo_id == dojo_id, Turma.active.is_(True))
        )
    )
    return result.scalar_one_or_none()


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


async def _ensure_enrollment_active(
    session: AsyncSession,
    turma_id: int,
    student_id: int,
) -> None:
    result = await session.execute(
        select(TurmaEnrollment).where(
            and_(
                TurmaEnrollment.turma_id == turma_id,
                TurmaEnrollment.student_id == student_id,
                TurmaEnrollment.active.is_(True),
            )
        )
    )
    if result.scalar_one_or_none() is None:
        raise ValueError("Aluno não está matriculado nesta turma")


async def _ensure_capacity_and_idempotent(
    session: AsyncSession,
    dojo_id: int,
    turma: Turma,
    student_id: int,
    when: datetime,
) -> None:
    session_date = when.date()

    # Idempotência: não permitir dois check-ins do mesmo aluno na mesma turma e dia
    existing = await session.execute(
        select(CheckIn).where(
            and_(
                CheckIn.dojo_id == dojo_id,
                CheckIn.turma_id == turma.id,
                CheckIn.student_id == student_id,
                func.date(CheckIn.occurred_at) == session_date,
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("Check-in já registrado para esta aula")

    # Capacidade: contar check-ins do dia para a turma
    count_result = await session.execute(
        select(func.count())
        .select_from(CheckIn)
        .where(
            and_(
                CheckIn.dojo_id == dojo_id,
                CheckIn.turma_id == turma.id,
                func.date(CheckIn.occurred_at) == session_date,
            )
        )
    )
    current_count = int(count_result.scalar_one() or 0)
    if current_count >= turma.capacity:
        raise ValueError("Capacidade da turma atingida para esta aula")


async def create_checkin(
    session: AsyncSession,
    user: User,
    data: CheckInCreate,
) -> CheckIn:
    if user.dojo_id is None:
        raise ValueError("Usuário não está associado a um dojo")

    dojo_id = user.dojo_id
    turma = await _get_turma_for_dojo(session, dojo_id, data.turma_id)
    if turma is None:
        raise ValueError("Turma inválida para este dojo")

    _check_checkin_allowed_until_start(turma)

    now = datetime.now(UTC)

    # Admin pode fazer check-in manual para qualquer aluno do dojo
    if user.role == "admin":
        if data.student_id is None:
            raise ValueError("student_id é obrigatório para check-in de admin")
        student = await _get_student_in_dojo(session, dojo_id, data.student_id)
        if student is None:
            raise ValueError("Aluno inválido para este dojo")

        await _ensure_capacity_and_idempotent(
            session,
            dojo_id,
            turma,
            student.id,
            now,
        )

        # consome 1 crédito da assinatura ativa
        await consume_credit_for_checkin(session, dojo_id, student.id, now)

        checkin = CheckIn(
            dojo_id=dojo_id,
            turma_id=turma.id,
            student_id=student.id,
            occurred_at=now,
            checked_in_by_user_id=user.id,
        )
        session.add(checkin)
        await session.commit()
        await session.refresh(checkin)
        return checkin

    # Aluno logado
    if user.role == "aluno":
        # Encontrar o student associado ao user (se ele mesmo for aluno)
        result = await session.execute(
            select(Student).where(
                and_(
                    Student.user_id == user.id,
                    Student.dojo_id == dojo_id,
                )
            )
        )
        self_student = result.scalar_one_or_none()

        # Turma regular: o próprio aluno faz check-in
        if turma.tipo == "regular":
            if self_student is None:
                raise ValueError("Usuário não possui aluno vinculado")

            await _ensure_capacity_and_idempotent(
                session,
                dojo_id,
                turma,
                self_student.id,
                now,
            )

            await consume_credit_for_checkin(session, dojo_id, self_student.id, now)

            checkin = CheckIn(
                dojo_id=dojo_id,
                turma_id=turma.id,
                student_id=self_student.id,
                occurred_at=now,
                checked_in_by_user_id=user.id,
            )
            session.add(checkin)
            await session.commit()
            await session.refresh(checkin)
            return checkin

        # Turma KIDS: apenas responsáveis podem fazer check-in (para o aluno kid). Alunos convencionais não podem.
        if turma.tipo == "kids":
            if data.student_id is None:
                raise ValueError(
                    "Em turmas kids apenas responsáveis podem fazer check-in. "
                    "Informe o aluno (student_id) que deseja fazer check-in."
                )
            kid = await _get_student_in_dojo(session, dojo_id, data.student_id)
            if kid is None:
                raise ValueError("Aluno inválido para este dojo")
            guardian_result = await session.execute(
                select(StudentGuardian).where(
                    and_(
                        StudentGuardian.dojo_id == dojo_id,
                        StudentGuardian.user_id == user.id,
                        StudentGuardian.student_id == kid.id,
                    )
                )
            )
            if guardian_result.scalar_one_or_none() is None:
                raise ValueError(
                    "Em turmas kids apenas responsáveis podem fazer check-in. "
                    "Você não é responsável por este aluno."
                )

            await _ensure_capacity_and_idempotent(
                session,
                dojo_id,
                turma,
                kid.id,
                now,
            )

            await consume_credit_for_checkin(session, dojo_id, kid.id, now)

            checkin = CheckIn(
                dojo_id=dojo_id,
                turma_id=turma.id,
                student_id=kid.id,
                occurred_at=now,
                checked_in_by_user_id=user.id,
            )
            session.add(checkin)
            await session.commit()
            await session.refresh(checkin)
            return checkin

        raise ValueError("Tipo de turma inválido para check-in")

    raise ValueError("Papel de usuário não autorizado para check-in")


async def list_my_checkins(
    session: AsyncSession,
    user: User,
    target_date: date | None = None,
) -> list[CheckIn]:
    """Retorna os check-ins do dia do aluno/responsável (para turmas em que fez check-in hoje)."""
    if user.dojo_id is None:
        return []

    dojo_id = user.dojo_id
    when = target_date or datetime.now(UTC).date()

    # Para admin: retorna vazio (usa list_checkins)
    if user.role == "admin":
        return []

    # Para aluno: busca o Student do usuário e os check-ins dele no dia
    if user.role == "aluno":
        result = await session.execute(
            select(Student).where(
                and_(
                    Student.user_id == user.id,
                    Student.dojo_id == dojo_id,
                )
            )
        )
        self_student = result.scalar_one_or_none()
        if self_student is None:
            return []

        q = (
            select(CheckIn)
            .where(
                and_(
                    CheckIn.dojo_id == dojo_id,
                    CheckIn.student_id == self_student.id,
                    func.date(CheckIn.occurred_at) == when,
                )
            )
            .order_by(CheckIn.occurred_at.desc())
        )
        res = await session.execute(q)
        return list(res.scalars().all())

    # Responsável: pode ter feito check-in para vários filhos; buscar todos os check-ins
    # onde checked_in_by_user_id == user.id no dia
    q = (
        select(CheckIn)
        .where(
            and_(
                CheckIn.dojo_id == dojo_id,
                CheckIn.checked_in_by_user_id == user.id,
                func.date(CheckIn.occurred_at) == when,
            )
        )
        .order_by(CheckIn.occurred_at.desc())
    )
    res = await session.execute(q)
    return list(res.scalars().all())


async def list_my_checkins_in_range(
    session: AsyncSession,
    user: User,
    start_date: date,
    end_date: date,
) -> list[CheckIn]:
    """Retorna os check-ins do aluno nos últimos N dias (para cálculo de assiduidade)."""
    if user.dojo_id is None or user.role != "aluno":
        return []

    result = await session.execute(
        select(Student).where(
            and_(
                Student.user_id == user.id,
                Student.dojo_id == user.dojo_id,
            )
        )
    )
    self_student = result.scalar_one_or_none()
    if self_student is None:
        return []

    q = (
        select(CheckIn)
        .where(
            and_(
                CheckIn.dojo_id == user.dojo_id,
                CheckIn.student_id == self_student.id,
                func.date(CheckIn.occurred_at) >= start_date,
                func.date(CheckIn.occurred_at) <= end_date,
            )
        )
        .order_by(CheckIn.occurred_at.desc())
    )
    res = await session.execute(q)
    return list(res.scalars().all())


async def list_checkins(
    session: AsyncSession,
    dojo_id: int,
    filters: CheckInFilter,
) -> list[tuple[CheckIn, str | None, int | None, str | None]]:
    from app.models.student import Student

    # Subconsulta com o "score" de cada aluno:
    # total de presenças confirmadas (presence_confirmed_at não nulo)
    score_subq = (
        select(
            CheckIn.student_id.label("s_id"),
            func.count().label("score"),
        )
        .where(
            and_(
                CheckIn.dojo_id == dojo_id,
                CheckIn.presence_confirmed_at.is_not(None),
            )
        )
        .group_by(CheckIn.student_id)
        .subquery()
    )

    query = (
        select(CheckIn, Student.name, score_subq.c.score, Turma.name)
        .join(Student, Student.id == CheckIn.student_id)
        .join(Turma, Turma.id == CheckIn.turma_id)
        .outerjoin(score_subq, score_subq.c.s_id == CheckIn.student_id)
        .where(CheckIn.dojo_id == dojo_id)
        .order_by(CheckIn.occurred_at.desc())
    )

    conditions = []
    if filters.turma_id is not None:
        conditions.append(CheckIn.turma_id == filters.turma_id)
    if filters.student_id is not None:
        conditions.append(CheckIn.student_id == filters.student_id)
    if filters.student_name is not None and filters.student_name.strip():
        conditions.append(
            func.lower(Student.name).like(f"%{filters.student_name.strip().lower()}%")
        )
    if filters.start_date is not None:
        conditions.append(
            func.date(CheckIn.occurred_at) >= filters.start_date
        )
    if filters.end_date is not None:
        conditions.append(
            func.date(CheckIn.occurred_at) <= filters.end_date
        )

    if conditions:
        query = query.where(and_(*conditions))

    result = await session.execute(query)
    return list(result.all())


async def cancel_checkin(
    session: AsyncSession,
    user: User,
    checkin_id: int,
) -> bool:
    """
    Cancela (remove) um check-in. Só permite se o check-in for do próprio aluno
    ou foi feito pelo usuário (responsável). Retorna True se removeu, False se não encontrou.
    """
    result = await session.execute(
        select(CheckIn).where(
            and_(CheckIn.id == checkin_id, CheckIn.dojo_id == user.dojo_id)
        )
    )
    checkin = result.scalar_one_or_none()
    if checkin is None:
        return False

    if user.role == "admin":
        await session.delete(checkin)
        await session.commit()
        return True

    if user.role == "aluno":
        result_st = await session.execute(
            select(Student).where(
                and_(
                    Student.user_id == user.id,
                    Student.dojo_id == user.dojo_id,
                )
            )
        )
        self_student = result_st.scalar_one_or_none()
        if self_student is None:
            return False
        if checkin.student_id != self_student.id:
            return False
        await session.delete(checkin)
        await session.commit()
        return True

    # Responsável: só pode cancelar se foi ele quem fez o check-in
    if checkin.checked_in_by_user_id != user.id:
        return False
    await session.delete(checkin)
    await session.commit()
    return True


async def confirm_presence(
    session: AsyncSession,
    admin: User,
    checkin_id: int,
) -> CheckIn | None:
    """
    Marca um check-in como presença confirmada pelo professor (admin).
    Retorna o check-in atualizado ou None se não encontrado/não permitido.
    """
    if admin.role != "admin" or admin.dojo_id is None:
        return None
    result = await session.execute(
        select(CheckIn).where(
            and_(CheckIn.id == checkin_id, CheckIn.dojo_id == admin.dojo_id)
        )
    )
    checkin = result.scalar_one_or_none()
    if checkin is None:
        return None
    now = datetime.now(UTC)
    checkin.presence_confirmed_at = now
    checkin.presence_confirmed_by_user_id = admin.id
    await session.commit()
    await session.refresh(checkin)
    return checkin


async def mark_checkin_absent(
    session: AsyncSession,
    admin: User,
    checkin_id: int,
) -> CheckIn | None:
    """
    Marca um check-in como ausente (aluno não veio). Devolve 1 crédito ao score
    do aluno. Só permite se o check-in ainda não foi confirmado nem marcado ausente.
    """
    if admin.role != "admin" or admin.dojo_id is None:
        return None
    result = await session.execute(
        select(CheckIn).where(
            and_(CheckIn.id == checkin_id, CheckIn.dojo_id == admin.dojo_id)
        )
    )
    checkin = result.scalar_one_or_none()
    if checkin is None:
        return None
    if checkin.presence_confirmed_at is not None:
        return None  # já confirmado como presente
    if checkin.marked_absent_at is not None:
        return None  # já marcado ausente
    now = datetime.now(UTC)
    checkin.marked_absent_at = now
    checkin.marked_absent_by_user_id = admin.id
    await refund_credit_for_checkin(
        session, admin.dojo_id, checkin.student_id, checkin.occurred_at
    )
    await session.commit()
    await session.refresh(checkin)
    return checkin

