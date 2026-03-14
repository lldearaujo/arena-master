from typing import Iterable

from sqlalchemy import Select, and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.faixa import Faixa
from app.models.student import Student
from app.models.student_guardian import StudentGuardian
from app.models.user import User
from app.models.dojo import Dojo
from app.core.security import get_password_hash
from app.modules.students.schemas import (
    GuardianLink,
    GuardianRead,
    StudentCreate,
    StudentRead,
    StudentUpdate,
)


def _students_query(dojo_id: int) -> Select[tuple[Student]]:
    return select(Student).where(Student.dojo_id == dojo_id).order_by(Student.id)


async def list_students(session: AsyncSession, dojo_id: int) -> list[Student]:
    result = await session.execute(_students_query(dojo_id))
    return list(result.scalars().all())


async def get_student(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
) -> Student | None:
    result = await session.execute(
        _students_query(dojo_id).where(Student.id == student_id)
    )
    return result.scalar_one_or_none()


async def create_student(
    session: AsyncSession,
    dojo_id: int,
    data: StudentCreate,
) -> tuple[Student, str, str]:
    # Primeiro criamos o registro do aluno
    student = Student(
        dojo_id=dojo_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        birth_date=data.birth_date,
        modalidade=data.modalidade,
        notes=data.notes,
        faixa_id=data.faixa_id,
        grau=data.grau,
    )
    session.add(student)
    # Garante que o ID do aluno seja gerado
    await session.flush()

    # Busca o dojo para compor o login
    dojo = await session.get(Dojo, dojo_id)
    dojo_name = dojo.name if dojo is not None else f"dojo{dojo_id}"

    # Regra de padronização de credenciais do aluno:
    # - e-mail de login: "{nome_do_aluno}@{nome_do_dojo}" (sem espaços, em minúsculas)
    # - senha padrão: aluno{student_id:04d}
    student_slug = student.name.strip().lower().replace(" ", "")
    dojo_slug = dojo_name.strip().lower().replace(" ", "")
    login_email = f"{student_slug}@{dojo_slug}"
    initial_password = f"aluno{student.id:04d}"
    password_hash = get_password_hash(initial_password)

    user = User(
        email=login_email,
        password_hash=password_hash,
        role="aluno",
        dojo_id=dojo_id,
        name=student.name,
        is_active=True,
    )
    session.add(user)
    await session.flush()

    # Vincula o usuário recém-criado ao aluno
    student.user_id = user.id

    await session.commit()
    await session.refresh(student)
    return student, initial_password, login_email


async def update_student(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    data: StudentUpdate,
) -> Student | None:
    student = await get_student(session, dojo_id, student_id)
    if student is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(student, field, value)

    await session.commit()
    await session.refresh(student)
    return student


async def delete_student(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
) -> bool:
    student = await get_student(session, dojo_id, student_id)
    if student is None:
        return False

    # Remove também o usuário vinculado, se existir
    if student.user_id is not None:
        result = await session.execute(
            select(User).where(User.id == student.user_id)
        )
        user = result.scalar_one_or_none()
        if user is not None:
            await session.delete(user)

    await session.delete(student)
    await session.commit()
    return True


async def list_guardians(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
) -> list[StudentGuardian]:
    result = await session.execute(
        select(StudentGuardian).where(
            and_(
                StudentGuardian.dojo_id == dojo_id,
                StudentGuardian.student_id == student_id,
            )
        )
    )
    return list(result.scalars().all())


async def add_guardian(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    data: GuardianLink,
) -> StudentGuardian:
    # garante que o aluno pertence ao dojo
    student = await get_student(session, dojo_id, student_id)
    if student is None:
        raise ValueError("Aluno não encontrado")

    # garante que o usuário existe e pertence ao mesmo dojo (ou é superadmin, se for o caso futuro)
    result = await session.execute(
        select(User).where(
            and_(
                User.id == data.user_id,
                User.dojo_id == dojo_id,
            )
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise ValueError("Usuário responsável inválido para este dojo")

    # evita duplicidade
    existing = await session.execute(
        select(StudentGuardian).where(
            and_(
                StudentGuardian.dojo_id == dojo_id,
                StudentGuardian.student_id == student_id,
                StudentGuardian.user_id == data.user_id,
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("Responsável já vinculado a este aluno")

    guardian = StudentGuardian(
        dojo_id=dojo_id,
        user_id=data.user_id,
        student_id=student_id,
    )
    session.add(guardian)
    await session.commit()
    await session.refresh(guardian)
    return guardian


async def remove_guardian(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    user_id: int,
) -> bool:
    result = await session.execute(
        select(StudentGuardian).where(
            and_(
                StudentGuardian.dojo_id == dojo_id,
                StudentGuardian.student_id == student_id,
                StudentGuardian.user_id == user_id,
            )
        )
    )
    guardian = result.scalar_one_or_none()
    if guardian is None:
        return False

    await session.delete(guardian)
    await session.commit()
    return True


async def get_student_for_user(
    session: AsyncSession,
    user: User,
) -> Student | None:
    if user.role != "aluno" or user.dojo_id is None:
        return None
    # 1) Busca por user_id (vínculo direto)
    result = await session.execute(
        select(Student).where(
            and_(
                Student.user_id == user.id,
                Student.dojo_id == user.dojo_id,
            )
        )
    )
    student = result.scalar_one_or_none()
    if student is not None:
        return student
    # 2) Fallback: busca por email no mesmo dojo
    result = await session.execute(
        select(Student).where(
            and_(
                Student.dojo_id == user.dojo_id,
                Student.email == user.email,
            )
        )
    )
    student = result.scalar_one_or_none()
    if student is not None:
        return student
    # 3) Fallback: login padrão é "nomestudante@nomdojo" - encontra aluno pelo padrão
    dojo = await session.get(Dojo, user.dojo_id)
    dojo_slug = (dojo.name.strip().lower().replace(" ", "") if dojo else "") or str(user.dojo_id)
    if "@" not in user.email:
        return None
    result = await session.execute(
        select(Student).where(
            and_(
                Student.dojo_id == user.dojo_id,
                Student.user_id.is_(None),
            )
        )
    )
    for s in result.scalars().all():
        slug = s.name.strip().lower().replace(" ", "")
        if f"{slug}@{dojo_slug}" == user.email.lower():
            return s
    return None


def _format_graduacao(faixa: Faixa | None, grau: int) -> str | None:
    if faixa is None:
        return None
    if grau <= 0:
        return f"Faixa {faixa.name}"
    if faixa.exibir_como_dan:
        return f"Faixa {faixa.name} {grau}º dan"
    return f"Faixa {faixa.name} {grau}º grau"


async def get_graduacao_display(
    session: AsyncSession,
    student: Student,
) -> str | None:
    if student.faixa_id is None:
        return None
    result = await session.execute(
        select(Faixa).where(Faixa.id == student.faixa_id)
    )
    faixa = result.scalar_one_or_none()
    return _format_graduacao(faixa, student.grau)

