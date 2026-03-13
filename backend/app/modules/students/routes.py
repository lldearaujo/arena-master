from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_user
from app.models.student import Student
from app.models.user import User
from app.modules.students import schemas, service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]
UserDep = Annotated[User, Depends(get_current_user)]


async def _student_to_read(
    session: SessionDep,
    student: Student,
) -> schemas.StudentRead:
    graduacao = await service.get_graduacao_display(session, student)
    return schemas.StudentRead(
        id=student.id,
        dojo_id=student.dojo_id,
        user_id=student.user_id,
        name=student.name,
        email=student.email,
        phone=student.phone,
        birth_date=student.birth_date,
        notes=student.notes,
        faixa_id=student.faixa_id,
        grau=student.grau,
        graduacao=graduacao,
    )


@router.get("/", response_model=list[schemas.StudentWithLoginRead])
async def list_students(
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.StudentWithLoginRead]:
    students = await service.list_students(session, admin.dojo_id)

    # Busca os logins (emails de acesso) dos usuários vinculados aos alunos
    user_ids = [s.user_id for s in students if s.user_id is not None]
    login_by_user_id: dict[int, str] = {}
    if user_ids:
        result = await session.execute(
            select(User.id, User.email).where(User.id.in_(user_ids))
        )
        for user_id, email in result.all():
            login_by_user_id[user_id] = email

    items: list[schemas.StudentWithLoginRead] = []
    for s in students:
        login_email = login_by_user_id.get(s.user_id) if s.user_id is not None else None
        base = await _student_to_read(session, s)
        items.append(
            schemas.StudentWithLoginRead(
                **base.model_dump(),
                login_email=login_email,
            )
        )
    return items


@router.post(
    "/",
    response_model=schemas.StudentCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_student(
    payload: schemas.StudentCreate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.StudentCreatedResponse:
    student, initial_password, login_email = await service.create_student(
        session, admin.dojo_id, payload
    )
    student_read = await _student_to_read(session, student)
    return schemas.StudentCreatedResponse(
        student=student_read,
        initial_password=initial_password,
        login_email=login_email,
    )


@router.get("/{student_id}", response_model=schemas.StudentRead)
async def get_student(
    student_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.StudentRead:
    student = await service.get_student(session, admin.dojo_id, student_id)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado",
        )
    return await _student_to_read(session, student)


@router.put("/{student_id}", response_model=schemas.StudentRead)
async def update_student(
    student_id: int,
    payload: schemas.StudentUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.StudentRead:
    student = await service.update_student(
        session,
        admin.dojo_id,
        student_id,
        payload,
    )
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado",
        )
    return await _student_to_read(session, student)


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    deleted = await service.delete_student(session, admin.dojo_id, student_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado",
        )


@router.get("/{student_id}/guardians", response_model=list[schemas.GuardianRead])
async def list_student_guardians(
    student_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.GuardianRead]:
    guardians = await service.list_guardians(
        session,
        admin.dojo_id,
        student_id,
    )
    return [schemas.GuardianRead.model_validate(g) for g in guardians]


@router.post(
    "/{student_id}/guardians",
    response_model=schemas.GuardianRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_student_guardian(
    student_id: int,
    payload: schemas.GuardianLink,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.GuardianRead:
    try:
        guardian = await service.add_guardian(
            session,
            admin.dojo_id,
            student_id,
            payload,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return schemas.GuardianRead.model_validate(guardian)


@router.delete("/{student_id}/guardians/{user_id}", status_code=204)
async def remove_student_guardian(
    student_id: int,
    user_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    removed = await service.remove_guardian(
        session,
        admin.dojo_id,
        student_id,
        user_id,
    )
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Responsável não encontrado para este aluno",
        )


@router.get("/me", response_model=schemas.StudentRead)
async def get_me(
    user: UserDep,
    session: SessionDep,
) -> schemas.StudentRead:
    student = await service.get_student_for_user(session, user)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado para este usuário",
        )
    return await _student_to_read(session, student)

