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
  modalidade: str | None = None
  if user.role == "aluno":
    student = await students_service.get_student_for_user(session, user)
    modalidade = (student.modalidade or "").strip() if student is not None else None
  rows = await service.list_mural_posts(
      session, user.dojo_id, user_id=user.id, modalidade=modalidade
  )
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


@router.get("/unread-count", response_model=schemas.MuralUnreadCount)
async def mural_unread_count(user: UserDep, session: SessionDep) -> schemas.MuralUnreadCount:
    if user.dojo_id is None:
        return schemas.MuralUnreadCount(unread_count=0)
    count = await service.get_unread_mural_posts_count(
        session, dojo_id=user.dojo_id, user=user
    )
    return schemas.MuralUnreadCount(unread_count=count)


@router.post("/mark-seen", response_model=schemas.MuralSeenState)
async def mark_mural_seen(user: UserDep, session: SessionDep) -> schemas.MuralSeenState:
    last_seen_at = await service.mark_mural_seen(session, user=user)
    return schemas.MuralSeenState(last_seen_at=last_seen_at)


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
        # Aluno publica apenas na sua modalidade.
        modalidade = (student.modalidade or "").strip() if student is not None else ""
        if not modalidade:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aluno sem modalidade definida; não é possível publicar no mural",
            )
        modalidades = [modalidade]
    else:
        # Admin escolhe para quais modalidades publicar.
        raw = payload.modalidades or []
        cleaned = [str(x).strip() for x in raw if str(x).strip()]
        # Remove duplicatas por casefold preservando o primeiro.
        seen: set[str] = set()
        modalidades = []
        for m in cleaned:
            key = m.casefold()
            if key in seen:
                continue
            seen.add(key)
            modalidades.append(m)
        if not modalidades:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selecione ao menos uma modalidade para publicar o recado",
            )

    post = await service.create_mural_post(
        session,
        user.dojo_id,
        title=payload.title,
        content=payload.content,
        author_name=author_name,
        author_id=user.id,
        author_avatar_url=user.avatar_url,
        modalidades=modalidades,
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
    modalidades = None
    if payload.modalidades is not None:
        cleaned = [str(x).strip() for x in (payload.modalidades or []) if str(x).strip()]
        seen: set[str] = set()
        modalidades = []
        for m in cleaned:
            key = m.casefold()
            if key in seen:
                continue
            seen.add(key)
            modalidades.append(m)
        if not modalidades:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selecione ao menos uma modalidade",
            )
    post = await service.update_mural_post(
        session,
        admin.dojo_id,
        post_id,
        title=payload.title,
        content=payload.content,
        pinned=payload.pinned,
        modalidades=modalidades,
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

