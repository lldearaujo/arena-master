from datetime import UTC, datetime
from typing import Iterable

from sqlalchemy import Select, delete, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mural_comment import MuralComment
from app.models.mural_like import MuralCommentLike, MuralPostLike
from app.models.mural_post import MuralPost
from app.models.user import User


def _dojo_mural_query(
    dojo_id: int,
    *,
    user_id: int | None = None,
    modalidade: str | None = None,
) -> Select:
    likes_count_sq = (
        select(func.count(MuralPostLike.id))
        .where(MuralPostLike.post_id == MuralPost.id)
        .correlate(MuralPost)
        .scalar_subquery()
    )
    liked_by_me_sq = (
        exists(
            select(1).where(
                MuralPostLike.post_id == MuralPost.id,
                MuralPostLike.user_id == (user_id or -1),
            )
        )
        if user_id is not None
        else select(False).scalar_subquery()
    )
    q = (
        select(
            MuralPost,
            User.avatar_url,
            likes_count_sq.label("likes_count"),
            liked_by_me_sq.label("liked_by_me"),
        )
        .outerjoin(User, MuralPost.author_id == User.id)
        .where(MuralPost.dojo_id == dojo_id)
        .order_by(MuralPost.pinned.desc(), MuralPost.created_at.desc())
    )
    if modalidade is not None:
        nm = (modalidade or "").strip()
        if nm:
            # Legado/global (modalidades NULL) continua visível para todos no dojo.
            q = q.where(
                (MuralPost.modalidades.is_(None)) | (MuralPost.modalidades.contains([nm]))
            )
    return q


async def list_mural_posts(
    session: AsyncSession,
    dojo_id: int,
    *,
    user_id: int | None = None,
    modalidade: str | None = None,
) -> list[tuple[MuralPost, str | None, int, bool]]:
    """Retorna (post, avatar_url_do_autor, likes_count, liked_by_me)."""
    result = await session.execute(
        _dojo_mural_query(dojo_id, user_id=user_id, modalidade=modalidade)
    )
    return list(result.all())


async def get_unread_mural_posts_count(
    session: AsyncSession,
    *,
    dojo_id: int,
    user: User,
) -> int:
    if user.dojo_id is None:
        return 0

    last_seen = user.mural_last_seen_at
    q = select(func.count(MuralPost.id)).where(MuralPost.dojo_id == dojo_id)
    # Filtra por modalidade do aluno (quando disponível). Admin conta tudo no dojo.
    if user.role == "aluno":
        # Best-effort: tenta usar o texto em students.modalidade (única fonte no app hoje).
        from app.modules.students import service as students_service

        student = await students_service.get_student_for_user(session, user)
        nm = (getattr(student, "modalidade", None) or "").strip() if student else ""
        if nm:
            q = q.where((MuralPost.modalidades.is_(None)) | (MuralPost.modalidades.contains([nm])))
    if last_seen is not None:
        q = q.where(MuralPost.created_at > last_seen)
    # Evita considerar o próprio post como "não lido".
    q = q.where((MuralPost.author_id.is_(None)) | (MuralPost.author_id != user.id))

    res = await session.execute(q)
    return int(res.scalar_one() or 0)


async def mark_mural_seen(session: AsyncSession, *, user: User) -> datetime:
    now = datetime.now(UTC)
    user.mural_last_seen_at = now
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return now


async def create_mural_post(
    session: AsyncSession,
    dojo_id: int,
    title: str,
    content: str,
    author_name: str,
    author_id: int | None = None,
    author_avatar_url: str | None = None,
    modalidades: list[str] | None = None,
    pinned: bool = False,
) -> MuralPost:
    post = MuralPost(
        dojo_id=dojo_id,
        title=title,
        content=content,
        author_name=author_name,
        author_id=author_id,
        author_avatar_url=author_avatar_url,
        modalidades=modalidades,
        pinned=pinned,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(post)
    await session.commit()
    await session.refresh(post)
    return post


async def get_mural_post(
    session: AsyncSession,
    dojo_id: int,
    post_id: int,
) -> MuralPost | None:
    result = await session.execute(
        select(MuralPost).where(MuralPost.dojo_id == dojo_id, MuralPost.id == post_id)
    )
    return result.scalar_one_or_none()


async def update_mural_post(
    session: AsyncSession,
    dojo_id: int,
    post_id: int,
    *,
    title: str | None = None,
    content: str | None = None,
    pinned: bool | None = None,
    modalidades: list[str] | None = None,
) -> MuralPost | None:
    post = await get_mural_post(session, dojo_id, post_id)
    if post is None:
        return None

    if title is not None:
        post.title = title
    if content is not None:
        post.content = content
    if pinned is not None:
        post.pinned = pinned
    if modalidades is not None:
        post.modalidades = modalidades
    post.updated_at = datetime.now(UTC)

    await session.commit()
    await session.refresh(post)
    return post


async def delete_mural_post(
    session: AsyncSession,
    dojo_id: int,
    post_id: int,
) -> bool:
    post = await get_mural_post(session, dojo_id, post_id)
    if post is None:
        return False
    await session.delete(post)
    await session.commit()
    return True


async def delete_all_mural_posts(session: AsyncSession, dojo_id: int) -> int:
    result = await session.execute(
        delete(MuralPost).where(MuralPost.dojo_id == dojo_id)
    )
    await session.commit()
    return int(result.rowcount or 0)


async def like_post(
    session: AsyncSession, *, dojo_id: int, post_id: int, user_id: int
) -> tuple[int, bool]:
    post = await get_mural_post(session, dojo_id, post_id)
    if post is None:
        raise ValueError("post_not_found")

    exists_row = await session.execute(
        select(MuralPostLike.id).where(
            MuralPostLike.post_id == post_id, MuralPostLike.user_id == user_id
        )
    )
    if exists_row.scalar_one_or_none() is None:
        session.add(
            MuralPostLike(post_id=post_id, user_id=user_id, created_at=datetime.now(UTC))
        )
        await session.commit()

    count = await session.execute(
        select(func.count(MuralPostLike.id)).where(MuralPostLike.post_id == post_id)
    )
    return int(count.scalar_one() or 0), True


async def unlike_post(
    session: AsyncSession, *, dojo_id: int, post_id: int, user_id: int
) -> tuple[int, bool]:
    post = await get_mural_post(session, dojo_id, post_id)
    if post is None:
        raise ValueError("post_not_found")

    await session.execute(
        delete(MuralPostLike).where(
            MuralPostLike.post_id == post_id, MuralPostLike.user_id == user_id
        )
    )
    await session.commit()

    count = await session.execute(
        select(func.count(MuralPostLike.id)).where(MuralPostLike.post_id == post_id)
    )
    return int(count.scalar_one() or 0), False


async def get_mural_comment(
    session: AsyncSession, *, dojo_id: int, post_id: int, comment_id: int
) -> MuralComment | None:
    res = await session.execute(
        select(MuralComment).where(
            MuralComment.id == comment_id,
            MuralComment.dojo_id == dojo_id,
            MuralComment.post_id == post_id,
        )
    )
    return res.scalar_one_or_none()


async def like_comment(
    session: AsyncSession,
    *,
    dojo_id: int,
    post_id: int,
    comment_id: int,
    user_id: int,
) -> tuple[int, bool]:
    comment = await get_mural_comment(
        session, dojo_id=dojo_id, post_id=post_id, comment_id=comment_id
    )
    if comment is None:
        raise ValueError("comment_not_found")

    exists_row = await session.execute(
        select(MuralCommentLike.id).where(
            MuralCommentLike.comment_id == comment_id, MuralCommentLike.user_id == user_id
        )
    )
    if exists_row.scalar_one_or_none() is None:
        session.add(
            MuralCommentLike(
                comment_id=comment_id, user_id=user_id, created_at=datetime.now(UTC)
            )
        )
        await session.commit()

    count = await session.execute(
        select(func.count(MuralCommentLike.id)).where(
            MuralCommentLike.comment_id == comment_id
        )
    )
    return int(count.scalar_one() or 0), True


async def unlike_comment(
    session: AsyncSession,
    *,
    dojo_id: int,
    post_id: int,
    comment_id: int,
    user_id: int,
) -> tuple[int, bool]:
    comment = await get_mural_comment(
        session, dojo_id=dojo_id, post_id=post_id, comment_id=comment_id
    )
    if comment is None:
        raise ValueError("comment_not_found")

    await session.execute(
        delete(MuralCommentLike).where(
            MuralCommentLike.comment_id == comment_id, MuralCommentLike.user_id == user_id
        )
    )
    await session.commit()

    count = await session.execute(
        select(func.count(MuralCommentLike.id)).where(
            MuralCommentLike.comment_id == comment_id
        )
    )
    return int(count.scalar_one() or 0), False


async def list_post_likers(
    session: AsyncSession, *, dojo_id: int, post_id: int
) -> list[User]:
    post = await get_mural_post(session, dojo_id, post_id)
    if post is None:
        raise ValueError("post_not_found")
    res = await session.execute(
        select(User)
        .join(MuralPostLike, MuralPostLike.user_id == User.id)
        .where(MuralPostLike.post_id == post_id, User.dojo_id == dojo_id)
        .order_by(MuralPostLike.created_at.desc())
    )
    return list(res.scalars().all())


async def list_comment_likers(
    session: AsyncSession, *, dojo_id: int, post_id: int, comment_id: int
) -> list[User]:
    comment = await get_mural_comment(
        session, dojo_id=dojo_id, post_id=post_id, comment_id=comment_id
    )
    if comment is None:
        raise ValueError("comment_not_found")
    res = await session.execute(
        select(User)
        .join(MuralCommentLike, MuralCommentLike.user_id == User.id)
        .where(MuralCommentLike.comment_id == comment_id, User.dojo_id == dojo_id)
        .order_by(MuralCommentLike.created_at.desc())
    )
    return list(res.scalars().all())

