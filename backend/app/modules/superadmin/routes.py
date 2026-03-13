from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import require_superadmin
from app.models.user import User
from app.modules.dojos import service as dojos_service
from app.modules.students import schemas as student_schemas, service as students_service
from app.modules.superadmin import schemas as superadmin_schemas
from app.modules.superadmin.professores_service import (
    create_professor,
    delete_professor,
    get_professor,
    list_professores,
    update_professor,
)

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
SuperAdminDep = Annotated[User, Depends(require_superadmin)]


async def _get_dojo_or_404(session: AsyncSession, dojo_id: int):
    dojo = await dojos_service.get_dojo(session, dojo_id)
    if dojo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dojo não encontrado",
        )
    return dojo


# ---- Professores (admins do dojo) ----

@router.get(
    "/dojos/{dojo_id}/professores",
    response_model=list[superadmin_schemas.ProfessorRead],
)
async def list_professores_route(
    dojo_id: int,
    _: SuperAdminDep,
    session: SessionDep,
) -> list[superadmin_schemas.ProfessorRead]:
    await _get_dojo_or_404(session, dojo_id)
    users = await list_professores(session, dojo_id)
    return [superadmin_schemas.ProfessorRead.model_validate(u) for u in users]


@router.post(
    "/dojos/{dojo_id}/professores",
    response_model=superadmin_schemas.ProfessorRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_professor_endpoint(
    dojo_id: int,
    payload: superadmin_schemas.ProfessorCreate,
    _: SuperAdminDep,
    session: SessionDep,
) -> superadmin_schemas.ProfessorRead:
    await _get_dojo_or_404(session, dojo_id)
    try:
        user = await create_professor(session, dojo_id, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return superadmin_schemas.ProfessorRead.model_validate(user)


@router.put(
    "/dojos/{dojo_id}/professores/{user_id}",
    response_model=superadmin_schemas.ProfessorRead,
)
async def update_professor_endpoint(
    dojo_id: int,
    user_id: int,
    payload: superadmin_schemas.ProfessorUpdate,
    _: SuperAdminDep,
    session: SessionDep,
) -> superadmin_schemas.ProfessorRead:
    await _get_dojo_or_404(session, dojo_id)
    user = await update_professor(session, dojo_id, user_id, payload)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Professor não encontrado",
        )
    return superadmin_schemas.ProfessorRead.model_validate(user)


@router.delete(
    "/dojos/{dojo_id}/professores/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_professor_endpoint(
    dojo_id: int,
    user_id: int,
    _: SuperAdminDep,
    session: SessionDep,
) -> None:
    await _get_dojo_or_404(session, dojo_id)
    deleted = await delete_professor(session, dojo_id, user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Professor não encontrado",
        )


# ---- Alunos (por dojo) ----

@router.get(
    "/dojos/{dojo_id}/students",
    response_model=list[student_schemas.StudentRead],
)
async def list_students(
    dojo_id: int,
    _: SuperAdminDep,
    session: SessionDep,
) -> list[student_schemas.StudentRead]:
    await _get_dojo_or_404(session, dojo_id)
    students = await students_service.list_students(session, dojo_id)
    return [student_schemas.StudentRead.model_validate(s) for s in students]


@router.post(
    "/dojos/{dojo_id}/students",
    response_model=student_schemas.StudentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_student(
    dojo_id: int,
    payload: student_schemas.StudentCreate,
    _: SuperAdminDep,
    session: SessionDep,
) -> student_schemas.StudentRead:
    await _get_dojo_or_404(session, dojo_id)
    student = await students_service.create_student(session, dojo_id, payload)
    return student_schemas.StudentRead.model_validate(student)


@router.put(
    "/dojos/{dojo_id}/students/{student_id}",
    response_model=student_schemas.StudentRead,
)
async def update_student(
    dojo_id: int,
    student_id: int,
    payload: student_schemas.StudentUpdate,
    _: SuperAdminDep,
    session: SessionDep,
) -> student_schemas.StudentRead:
    await _get_dojo_or_404(session, dojo_id)
    student = await students_service.update_student(
        session, dojo_id, student_id, payload
    )
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado",
        )
    return student_schemas.StudentRead.model_validate(student)


@router.delete(
    "/dojos/{dojo_id}/students/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_student(
    dojo_id: int,
    student_id: int,
    _: SuperAdminDep,
    session: SessionDep,
) -> None:
    await _get_dojo_or_404(session, dojo_id)
    deleted = await students_service.delete_student(session, dojo_id, student_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado",
        )
