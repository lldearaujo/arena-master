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


def _checkins_query(dojo_id: int) -> Select[tuple[CheckIn]]:
    return select(CheckIn).where(CheckIn.dojo_id == dojo_id).order_by(
        CheckIn.occurred_at.desc()
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

        # Turma KIDS: responsável faz check-in para o filho, ou o próprio aluno (criança) se fizer para si
        if turma.tipo == "kids":
            if data.student_id is not None:
                # Responsável fazendo check-in para o filho
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
                    raise ValueError("Usuário não é responsável por este aluno")
            elif self_student is not None:
                # O próprio aluno (criança) fazendo check-in em turma kids
                kid = self_student
            else:
                raise ValueError("student_id é obrigatório para turmas KIDS ou usuário deve ter aluno vinculado")

            await _ensure_capacity_and_idempotent(
                session,
                dojo_id,
                turma,
                kid.id,
                now,
            )

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
) -> list[CheckIn]:
    query = _checkins_query(dojo_id)

    conditions = []
    if filters.turma_id is not None:
        conditions.append(CheckIn.turma_id == filters.turma_id)
    if filters.student_id is not None:
        conditions.append(CheckIn.student_id == filters.student_id)
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
    return list(result.scalars().all())


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

