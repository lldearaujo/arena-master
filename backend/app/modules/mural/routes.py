from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_user
from app.models.user import User
from app.modules.mural import schemas, service
from app.modules.students import service as students_service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]
UserDep = Annotated[User, Depends(get_current_user)]


@router.get("/", response_model=list[schemas.MuralPostRead])
async def list_my_mural(user: UserDep, session: SessionDep) -> list[schemas.MuralPostRead]:
  if user.dojo_id is None:
    return []
  rows = await service.list_mural_posts(session, user.dojo_id)
  result = []
  for post, user_avatar in rows:
    # Usa avatar do User (atual) quando disponível, senão o gravado no post
    avatar = user_avatar if user_avatar is not None else post.author_avatar_url
    data = schemas.MuralPostRead.model_validate(post)
    data.author_avatar_url = avatar
    result.append(data)
  return result


@router.post(
    "/",
    response_model=schemas.MuralPostRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_mural_post(
    payload: schemas.MuralPostCreate,
    user: UserDep,
    session: SessionDep,
) -> schemas.MuralPostRead:
    if user.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário não está associado a um dojo",
        )

    # Qualquer usuário pode criar recado, mas apenas admin pode criar já fixado
    pinned = payload.pinned if user.role == "admin" else False

    author_name = user.name or user.email
    if user.role == "aluno":
        student = await students_service.get_student_for_user(session, user)
        if student is not None:
            author_name = student.name

    post = await service.create_mural_post(
        session,
        user.dojo_id,
        title=payload.title,
        content=payload.content,
        author_name=author_name,
        author_id=user.id,
        author_avatar_url=user.avatar_url,
        pinned=pinned,
    )
    return schemas.MuralPostRead.model_validate(post)


@router.put("/{post_id}", response_model=schemas.MuralPostRead)
async def update_mural_post(
    post_id: int,
    payload: schemas.MuralPostUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.MuralPostRead:
    post = await service.update_mural_post(
        session,
        admin.dojo_id,
        post_id,
        title=payload.title,
        content=payload.content,
        pinned=payload.pinned,
    )
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recado não encontrado",
        )
    return schemas.MuralPostRead.model_validate(post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mural_post(
    post_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    deleted = await service.delete_mural_post(session, admin.dojo_id, post_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recado não encontrado",
        )

