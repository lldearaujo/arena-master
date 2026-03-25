from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_user
from app.models.user import User
from app.modules.skills import schemas, service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]
UserDep = Annotated[User, Depends(get_current_user)]


@router.get("/config", response_model=schemas.SkillsConfigRead)
async def get_config(admin: AdminDep, session: SessionDep) -> schemas.SkillsConfigRead:
    cfg = await service.get_or_create_config(session, admin.dojo_id)
    return schemas.SkillsConfigRead(
        skills=[cfg.skill_1, cfg.skill_2, cfg.skill_3, cfg.skill_4, cfg.skill_5]
    )


@router.put("/config", response_model=schemas.SkillsConfigRead)
async def update_config(
    payload: schemas.SkillsConfigUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.SkillsConfigRead:
    try:
        cfg = await service.update_config(session, admin.dojo_id, payload.skills)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    return schemas.SkillsConfigRead(
        skills=[cfg.skill_1, cfg.skill_2, cfg.skill_3, cfg.skill_4, cfg.skill_5]
    )


@router.get("/overview", response_model=schemas.SkillsOverviewRead)
async def overview(admin: AdminDep, session: SessionDep) -> schemas.SkillsOverviewRead:
    data = await service.get_overview(session, admin.dojo_id)
    return schemas.SkillsOverviewRead.model_validate(data)


@router.put(
    "/students/{student_id}",
    response_model=schemas.StudentSkillRatingsRead,
)
async def set_student_ratings(
    student_id: int,
    payload: schemas.StudentSkillRatingsUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.StudentSkillRatingsRead:
    try:
        row = await service.set_student_ratings(
            session, admin.dojo_id, student_id, payload.ratings
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc

    # buscamos o nome do aluno para responder de forma amigável
    overview = await service.get_overview(session, admin.dojo_id)
    student = next((s for s in overview["students"] if s["student_id"] == student_id), None)
    return schemas.StudentSkillRatingsRead(
        student_id=student_id,
        student_name=student["student_name"] if student else "",
        skills=student["skills"] if student else [],
        ratings=[row.rating_1, row.rating_2, row.rating_3, row.rating_4, row.rating_5],
    )


@router.get("/me", response_model=schemas.MySkillsRead)
async def my_skills(user: UserDep, session: SessionDep) -> schemas.MySkillsRead:
    if user.role != "aluno" or user.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a alunos",
        )
    # o student_id usado nas avaliações é o id do registro de Student
    from app.modules.students import service as students_service

    student = await students_service.get_student_for_user(session, user)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado para este usuário",
        )
    skills, ratings = await service.get_student_skills(session, user.dojo_id, student.id)
    return schemas.MySkillsRead(skills=skills, ratings=ratings)

