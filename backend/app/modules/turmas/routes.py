from datetime import date as _date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_user
from app.models.user import User
from app.modules.turmas import schemas, service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]
UserDep = Annotated[User, Depends(get_current_user)]


@router.get("/my", response_model=list[schemas.TurmaMyRead])
async def my_turmas(
    user: UserDep,
    session: SessionDep,
) -> list[schemas.TurmaMyRead]:
    turmas = await service.turmas_for_student(session, user)
    if not turmas or user.dojo_id is None:
        return []
    counts = await service.get_checkin_counts_today(
        session, user.dojo_id, [t.id for t in turmas]
    )
    return [
        schemas.TurmaMyRead(
            **schemas.TurmaRead.model_validate(t).model_dump(),
            vagas_restantes=max(0, t.capacity - counts.get(t.id, 0)),
        )
        for t in turmas
    ]


@router.get("/my-kids")
async def my_kids_turmas(
    user: UserDep,
    session: SessionDep,
) -> list[dict]:
    pairs = await service.turmas_for_guardian_kids(session, user)
    if not pairs:
        return []
    turma_ids = list({t.id for _, t in pairs})
    dojo_id = pairs[0][1].dojo_id  # dojo da primeira turma (todas são do mesmo dojo)
    counts = await service.get_checkin_counts_today(
        session, dojo_id, turma_ids
    )
    response: list[dict] = []
    for student, turma in pairs:
        vagas = max(0, turma.capacity - counts.get(turma.id, 0))
        response.append(
            {
                "student": {
                    "id": student.id,
                    "name": student.name,
                    "dojo_id": student.dojo_id,
                },
                "turma": {
                    **schemas.TurmaRead.model_validate(turma).model_dump(),
                    "vagas_restantes": vagas,
                },
            }
        )
    return response


@router.get("/", response_model=list[schemas.TurmaRead])
async def list_turmas(
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.TurmaRead]:
    turmas = await service.list_turmas(session, admin.dojo_id)
    return [schemas.TurmaRead.model_validate(t) for t in turmas]


@router.get("/modalidades", response_model=list[str])
async def list_modalidades(
    admin: AdminDep,
    session: SessionDep,
) -> list[str]:
    if admin.dojo_id is None:
        return []
    return await service.list_modalidades_for_dojo(session, admin.dojo_id)


@router.post(
    "/",
    response_model=schemas.TurmaRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_turma(
    payload: schemas.TurmaCreate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.TurmaRead:
    turma = await service.create_turma(session, admin.dojo_id, payload)
    return schemas.TurmaRead.model_validate(turma)


@router.get(
    "/{turma_id}/check-ins",
    response_model=list[schemas.TurmaCheckInAttendee],
)
async def list_turma_checkins(
    turma_id: int,
    user: UserDep,
    session: SessionDep,
    date_str: str | None = Query(default=None, alias="date"),
) -> list[schemas.TurmaCheckInAttendee]:
    """Lista alunos que fizeram check-in na turma na data (default: hoje)."""
    if user.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário não está associado a um dojo",
        )
    target = None
    if date_str:
        try:
            target = _date.fromisoformat(date_str)
        except ValueError:
            pass
    students_with_avatar = await service.list_checkins_for_turma(
        session, user.dojo_id, turma_id, target
    )
    from app.modules.students import service as students_service

    result = []
    for student, avatar_url in students_with_avatar:
        graduacao = await students_service.get_graduacao_display(session, student)
        result.append(
            schemas.TurmaCheckInAttendee(
                student_id=student.id,
                student_name=student.name,
                graduacao=graduacao,
                avatar_url=avatar_url,
            )
        )
    return result


@router.get("/{turma_id}", response_model=schemas.TurmaRead)
async def get_turma(
    turma_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.TurmaRead:
    turma = await service.get_turma(session, admin.dojo_id, turma_id)
    if turma is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turma não encontrada",
        )
    return schemas.TurmaRead.model_validate(turma)


@router.put("/{turma_id}", response_model=schemas.TurmaRead)
async def update_turma(
    turma_id: int,
    payload: schemas.TurmaUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.TurmaRead:
    turma = await service.update_turma(
        session,
        admin.dojo_id,
        turma_id,
        payload,
    )
    if turma is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turma não encontrada",
        )
    return schemas.TurmaRead.model_validate(turma)


@router.delete("/{turma_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_turma(
    turma_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    deleted = await service.delete_turma(session, admin.dojo_id, turma_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Turma não encontrada",
        )


@router.post(
    "/{turma_id}/enroll",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def enroll_student(
    turma_id: int,
    payload: schemas.EnrollmentRequest,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    try:
        await service.enroll_student(
            session,
            admin.dojo_id,
            turma_id,
            payload,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{turma_id}/enroll",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unenroll_student(
    turma_id: int,
    student_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    removed = await service.unenroll_student(
        session,
        admin.dojo_id,
        turma_id,
        student_id,
    )
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Matrícula não encontrada",
        )
