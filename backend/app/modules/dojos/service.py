from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dojo import Dojo
from app.modules.dojos.schemas import DojoCreate, DojoUpdate


async def list_dojos(session: AsyncSession) -> list[Dojo]:
    result = await session.execute(select(Dojo).order_by(Dojo.id))
    return list(result.scalars().all())


async def get_dojo(session: AsyncSession, dojo_id: int) -> Dojo | None:
    result = await session.execute(select(Dojo).where(Dojo.id == dojo_id))
    return result.scalar_one_or_none()


async def create_dojo(session: AsyncSession, data: DojoCreate) -> Dojo:
    dojo = Dojo(**data.model_dump())
    session.add(dojo)
    await session.commit()
    await session.refresh(dojo)
    return dojo


async def update_dojo(session: AsyncSession, dojo_id: int, data: DojoUpdate) -> Dojo | None:
    dojo = await get_dojo(session, dojo_id)
    if dojo is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dojo, field, value)

    await session.commit()
    await session.refresh(dojo)
    return dojo


async def delete_dojo(session: AsyncSession, dojo_id: int) -> bool:
    dojo = await get_dojo(session, dojo_id)
    if dojo is None:
        return False
    await session.delete(dojo)
    await session.commit()
    return True

