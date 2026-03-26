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
  rows = await service.list_mural_posts(session, user.dojo_id, user_id=user.id)
  result = []
  for post, user_avatar, likes_count, liked_by_me in rows:
    # Usa avatar do User (atual) quando disponível, senão o gravado no post
    avatar = user_avatar if user_avatar is not None else post.author_avatar_url
    data = schemas.MuralPostRead.model_validate(post)
    data.author_avatar_url = avatar
    data.likes_count = int(likes_count or 0)
    data.liked_by_me = bool(liked_by_me)
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


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_mural_posts(admin: AdminDep, session: SessionDep) -> None:
    if admin.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário não está associado a um dojo",
        )
    await service.delete_all_mural_posts(session, admin.dojo_id)


@router.post("/{post_id}/like", response_model=schemas.LikeState)
async def like_mural_post(post_id: int, user: UserDep, session: SessionDep) -> schemas.LikeState:
    if user.dojo_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário não está associado a um dojo")
    try:
        likes_count, liked_by_me = await service.like_post(
            session, dojo_id=user.dojo_id, post_id=post_id, user_id=user.id
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recado não encontrado")
    return schemas.LikeState(likes_count=likes_count, liked_by_me=liked_by_me)


@router.delete("/{post_id}/like", response_model=schemas.LikeState)
async def unlike_mural_post(post_id: int, user: UserDep, session: SessionDep) -> schemas.LikeState:
    if user.dojo_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário não está associado a um dojo")
    try:
        likes_count, liked_by_me = await service.unlike_post(
            session, dojo_id=user.dojo_id, post_id=post_id, user_id=user.id
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recado não encontrado")
    return schemas.LikeState(likes_count=likes_count, liked_by_me=liked_by_me)


@router.post("/{post_id}/comments/{comment_id}/like", response_model=schemas.LikeState)
async def like_mural_comment(
    post_id: int,
    comment_id: int,
    user: UserDep,
    session: SessionDep,
) -> schemas.LikeState:
    if user.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário não está associado a um dojo",
        )
    try:
        likes_count, liked_by_me = await service.like_comment(
            session,
            dojo_id=user.dojo_id,
            post_id=post_id,
            comment_id=comment_id,
            user_id=user.id,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comentário não encontrado"
        )
    return schemas.LikeState(likes_count=likes_count, liked_by_me=liked_by_me)


@router.delete("/{post_id}/comments/{comment_id}/like", response_model=schemas.LikeState)
async def unlike_mural_comment(
    post_id: int,
    comment_id: int,
    user: UserDep,
    session: SessionDep,
) -> schemas.LikeState:
    if user.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário não está associado a um dojo",
        )
    try:
        likes_count, liked_by_me = await service.unlike_comment(
            session,
            dojo_id=user.dojo_id,
            post_id=post_id,
            comment_id=comment_id,
            user_id=user.id,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comentário não encontrado"
        )
    return schemas.LikeState(likes_count=likes_count, liked_by_me=liked_by_me)


@router.get(
    "/{post_id}/likes/users",
    response_model=list[schemas.MuralLikerRead],
)
async def list_mural_post_likers(
    post_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.MuralLikerRead]:
    try:
        users = await service.list_post_likers(
            session, dojo_id=admin.dojo_id, post_id=post_id
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Recado não encontrado"
        )
    return [schemas.MuralLikerRead.model_validate(u) for u in users]


@router.get(
    "/{post_id}/comments/{comment_id}/likes/users",
    response_model=list[schemas.MuralLikerRead],
)
async def list_mural_comment_likers(
    post_id: int,
    comment_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.MuralLikerRead]:
    try:
        users = await service.list_comment_likers(
            session,
            dojo_id=admin.dojo_id,
            post_id=post_id,
            comment_id=comment_id,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comentário não encontrado"
        )
    return [schemas.MuralLikerRead.model_validate(u) for u in users]

