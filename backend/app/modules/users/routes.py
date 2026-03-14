from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.modules.users import schemas


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[User, Depends(get_current_user)]


async def _user_me_read(user: UserDep, session: SessionDep) -> schemas.UserMeRead:
    data = schemas.UserMeRead.model_validate(user)
    if user.role == "aluno" and user.dojo_id is not None:
        from app.modules.students import service as students_service

        student = await students_service.get_student_for_user(session, user)
        if student is not None:
            data.graduacao = await students_service.get_graduacao_display(
                session, student
            )
    return data


@router.get("/me", response_model=schemas.UserMeRead)
async def get_me(user: UserDep, session: SessionDep) -> schemas.UserMeRead:
    return await _user_me_read(user, session)


@router.patch("/me", response_model=schemas.UserMeRead)
async def update_me(
    payload: schemas.AvatarUpdate,
    user: UserDep,
    session: SessionDep,
) -> schemas.UserMeRead:
    if payload.avatar_url is not None:
        url = payload.avatar_url
        if len(url) > 350_000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Imagem muito grande. Escolha uma foto menor.",
            )
        user.avatar_url = url
    if payload.name is not None:
        user.name = payload.name.strip() or None
    if payload.avatar_url is not None or payload.name is not None:
        await session.commit()
        await session.refresh(user)
    return await _user_me_read(user, session)
