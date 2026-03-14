from datetime import UTC, datetime
from typing import Iterable

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mural_post import MuralPost
from app.models.user import User


def _dojo_mural_query(dojo_id: int) -> Select:
    return (
        select(MuralPost, User.avatar_url)
        .outerjoin(User, MuralPost.author_id == User.id)
        .where(MuralPost.dojo_id == dojo_id)
        .order_by(MuralPost.pinned.desc(), MuralPost.created_at.desc())
    )


async def list_mural_posts(session: AsyncSession, dojo_id: int) -> list[tuple[MuralPost, str | None]]:
    """Retorna lista de (post, avatar_url_do_autor). O avatar vem de User quando author_id existe."""
    result = await session.execute(_dojo_mural_query(dojo_id))
    return list(result.all())


async def create_mural_post(
    session: AsyncSession,
    dojo_id: int,
    title: str,
    content: str,
    author_name: str,
    author_id: int | None = None,
    author_avatar_url: str | None = None,
    pinned: bool = False,
) -> MuralPost:
    post = MuralPost(
        dojo_id=dojo_id,
        title=title,
        content=content,
        author_name=author_name,
        author_id=author_id,
        author_avatar_url=author_avatar_url,
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
        _dojo_mural_query(dojo_id).where(MuralPost.id == post_id)
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

