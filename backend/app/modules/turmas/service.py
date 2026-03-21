from typing import Iterable
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.check_in import CheckIn
from app.models.student import Student
from app.models.student_guardian import StudentGuardian
from app.models.dojo_modalidade import DojoModalidade
from app.models.turma import Turma
from app.models.turma_enrollment import TurmaEnrollment
from app.models.user import User
from app.modules.turmas.schemas import EnrollmentRequest, TurmaCreate, TurmaUpdate
#
# IMPORTANTE:
# Não podemos depender de tzdata/zoneinfo no ambiente.
# Usamos fuso fixo do Brasil (UTC-3) para alinhar dia/horário com o esperado.
#
BRAZIL_OFFSET = timedelta(hours=-3)


def _now_brazil() -> datetime:
    """Agora no fuso fixo do Brasil (UTC-3)."""
    return datetime.now(UTC) + BRAZIL_OFFSET



def _turmas_query(dojo_id: int) -> Select[tuple[Turma]]:
    return select(Turma).where(Turma.dojo_id == dojo_id).order_by(Turma.id)


async def list_turmas(session: AsyncSession, dojo_id: int) -> list[Turma]:
    result = await session.execute(_turmas_query(dojo_id))
    return list(result.scalars().all())


async def list_modalidades_for_dojo(session: AsyncSession, dojo_id: int) -> list[str]:
    """Modalidades: catálogo do dojo + valores já usados em alunos/turmas."""
    seen: set[str] = set()
    ordered: list[str] = []

    catalog = await session.execute(
        select(DojoModalidade.name)
        .where(DojoModalidade.dojo_id == dojo_id)
        .order_by(DojoModalidade.name)
    )
    for row in catalog.all():
        m = (row[0] or "").strip()
        if m and m not in seen:
            seen.add(m)
            ordered.append(m)

    student_rows = await session.execute(
        select(Student.modalidade)
        .where(
            and_(
                Student.dojo_id == dojo_id,
                Student.modalidade.is_not(None),
            )
        )
        .distinct()
        .order_by(Student.modalidade)
    )
    for row in student_rows.all():
        m = (row[0] or "").strip()
        if m and m not in seen:
            seen.add(m)
            ordered.append(m)

    turma_rows = await session.execute(
        select(Turma.modalidade)
        .where(
            and_(
                Turma.dojo_id == dojo_id,
                Turma.modalidade.is_not(None),
            )
        )
        .distinct()
        .order_by(Turma.modalidade)
    )
    for row in turma_rows.all():
        m = (row[0] or "").strip()
        if m and m not in seen:
            seen.add(m)
            ordered.append(m)

    ordered.sort(key=lambda x: x.casefold())
    return ordered


async def get_turma(
    session: AsyncSession,
    dojo_id: int,
    turma_id: int,
) -> Turma | None:
    result = await session.execute(
        _turmas_query(dojo_id).where(Turma.id == turma_id)
    )
    return result.scalar_one_or_none()


async def create_turma(
    session: AsyncSession,
    dojo_id: int,
    data: TurmaCreate,
) -> Turma:
    turma = Turma(
        dojo_id=dojo_id,
        name=data.name,
        description=data.description,
        modalidade=data.modalidade,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        capacity=data.capacity,
        active=data.active,
        tipo=data.tipo,
    )
    session.add(turma)
    await session.commit()
    await session.refresh(turma)
    return turma


async def update_turma(
    session: AsyncSession,
    dojo_id: int,
    turma_id: int,
    data: TurmaUpdate,
) -> Turma | None:
    turma = await get_turma(session, dojo_id, turma_id)
    if turma is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(turma, field, value)

    await session.commit()
    await session.refresh(turma)
    return turma


async def delete_turma(
    session: AsyncSession,
    dojo_id: int,
    turma_id: int,
) -> bool:
    turma = await get_turma(session, dojo_id, turma_id)
    if turma is None:
        return False

    await session.delete(turma)
    await session.commit()
    return True


async def enroll_student(
    session: AsyncSession,
    dojo_id: int,
    turma_id: int,
    data: EnrollmentRequest,
) -> TurmaEnrollment:
    turma = await get_turma(session, dojo_id, turma_id)
    if turma is None or not turma.active:
        raise ValueError("Turma inválida ou inativa")

    # garante que o aluno pertence ao dojo
    result = await session.execute(
        select(Student).where(
            and_(
                Student.id == data.student_id,
                Student.dojo_id == dojo_id,
            )
        )
    )
    student = result.scalar_one_or_none()
    if student is None:
        raise ValueError("Aluno inválido para este dojo")

    # evita matrícula duplicada ativa
    existing = await session.execute(
        select(TurmaEnrollment).where(
            and_(
                TurmaEnrollment.turma_id == turma_id,
                TurmaEnrollment.student_id == data.student_id,
                TurmaEnrollment.active.is_(True),
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("Aluno já está matriculado nesta turma")

    enrollment = TurmaEnrollment(
        turma_id=turma_id,
        student_id=data.student_id,
        active=True,
    )
    session.add(enrollment)
    await session.commit()
    await session.refresh(enrollment)
    return enrollment


async def unenroll_student(
    session: AsyncSession,
    dojo_id: int,
    turma_id: int,
    student_id: int,
) -> bool:
    turma = await get_turma(session, dojo_id, turma_id)
    if turma is None:
        return False

    result = await session.execute(
        select(TurmaEnrollment).where(
            and_(
                TurmaEnrollment.turma_id == turma_id,
                TurmaEnrollment.student_id == student_id,
                TurmaEnrollment.active.is_(True),
            )
        )
    )
    enrollment = result.scalar_one_or_none()
    if enrollment is None:
        return False

    enrollment.active = False
    await session.commit()
    return True


def _today_day_abbrev() -> str:
    """Retorna abreviação do dia atual: seg, ter, qua, qui, sex, sab, dom.
    Usa o fuso do Brasil para coincidir com o dia do usuário (ex.: Brasil)."""
    abbrevs = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]
    return abbrevs[_now_brazil().weekday()]


async def turmas_for_student(
    session: AsyncSession,
    user: User,
) -> list[Turma]:
    # apenas alunos logados com dojo definido
    if user.role != "aluno" or user.dojo_id is None:
        return []

    today = _today_day_abbrev()
    result = await session.execute(
        select(Turma)
        .where(
            and_(
                Turma.dojo_id == user.dojo_id,
                Turma.active.is_(True),
            )
        )
        .order_by(Turma.start_time)
    )
    all_turmas = list(result.scalars().all())
    filtered = [
        t
        for t in all_turmas
        if today in [d.strip() for d in t.day_of_week.split(",")]
    ]
    return filtered


async def get_checkin_counts_today(
    session: AsyncSession,
    dojo_id: int,
    turma_ids: list[int],
) -> dict[int, int]:
    """Retorna mapa turma_id -> quantidade de check-ins no dia de hoje."""
    if not turma_ids:
        return {}
    today = datetime.now(UTC).date()
    result = await session.execute(
        select(CheckIn.turma_id, func.count())
        .where(
            and_(
                CheckIn.dojo_id == dojo_id,
                CheckIn.turma_id.in_(turma_ids),
                func.date(CheckIn.occurred_at) == today,
            )
        )
        .group_by(CheckIn.turma_id)
    )
    return dict(result.all())


async def turmas_for_guardian_kids(
    session: AsyncSession,
    user: User,
) -> list[tuple[Student, Turma]]:
    # user é responsável, não necessariamente aluno
    # Usa dojo_id do usuário ou, se não tiver, do primeiro vínculo guardian (responsável pode não ter dojo setado)
    dojo_id = user.dojo_id
    if dojo_id is None:
        fallback = await session.execute(
            select(StudentGuardian.dojo_id)
            .where(StudentGuardian.user_id == user.id)
            .limit(1)
        )
        row = fallback.one_or_none()
        dojo_id = row[0] if row else None
    if dojo_id is None:
        return []

    today = _today_day_abbrev()

    # alunos (filhos) vinculados como guardians
    result = await session.execute(
        select(Student)
        .join(StudentGuardian, Student.id == StudentGuardian.student_id)
        .where(
            and_(
                StudentGuardian.dojo_id == dojo_id,
                StudentGuardian.user_id == user.id,
            )
        )
    )
    students = list(result.scalars().all())
    if not students:
        return []

    student_ids = [s.id for s in students]

    result = await session.execute(
        select(Student, Turma)
        .join(TurmaEnrollment, TurmaEnrollment.student_id == Student.id)
        .join(Turma, Turma.id == TurmaEnrollment.turma_id)
        .where(
            and_(
                Student.id.in_(student_ids),
                Turma.dojo_id == dojo_id,
                Turma.tipo == "kids",
                TurmaEnrollment.active.is_(True),
                Turma.active.is_(True),
            )
        )
        .order_by(Student.name, Turma.start_time)
    )
    pairs = list(result.all())
    return [
        (s, t)
        for s, t in pairs
        if today in [d.strip() for d in t.day_of_week.split(",")]
    ]


async def list_checkins_for_turma(
    session: AsyncSession,
    dojo_id: int,
    turma_id: int,
    target_date: date | None = None,
) -> list[tuple[Student, str | None]]:
    """Retorna alunos que fizeram check-in na turma na data informada.

    Retorna lista de (Student, avatar_url) para permitir exibir a foto de
    perfil na lista de presença.
    """
    turma = await get_turma(session, dojo_id, turma_id)
    if turma is None:
        return []

    when = target_date or datetime.now(UTC).date()
    result = await session.execute(
        select(Student, User.avatar_url)
        .join(CheckIn, CheckIn.student_id == Student.id)
        .outerjoin(User, User.id == Student.user_id)
        .where(
            and_(
                CheckIn.dojo_id == dojo_id,
                CheckIn.turma_id == turma_id,
                func.date(CheckIn.occurred_at) == when,
            )
        )
        .order_by(Student.name)
    )
    rows = result.all()
    return [(row[0], row[1]) for row in rows]

