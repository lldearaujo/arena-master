from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.faixa import Faixa
from app.modules.faixas.schemas import FaixaCreate, FaixaUpdate


async def list_faixas(session: AsyncSession, dojo_id: int) -> list[Faixa]:
    result = await session.execute(
        select(Faixa).where(Faixa.dojo_id == dojo_id).order_by(Faixa.ordem, Faixa.id)
    )
    return list(result.scalars().all())


async def get_faixa(
    session: AsyncSession,
    dojo_id: int,
    faixa_id: int,
) -> Faixa | None:
    result = await session.execute(
        select(Faixa).where(
            Faixa.id == faixa_id,
            Faixa.dojo_id == dojo_id,
        )
    )
    return result.scalar_one_or_none()


async def create_faixa(
    session: AsyncSession,
    dojo_id: int,
    data: FaixaCreate,
) -> Faixa:
    faixa = Faixa(
        dojo_id=dojo_id,
        name=data.name,
        ordem=data.ordem,
        max_graus=data.max_graus,
        exibir_como_dan=data.exibir_como_dan,
    )
    session.add(faixa)
    await session.commit()
    await session.refresh(faixa)
    return faixa


async def update_faixa(
    session: AsyncSession,
    dojo_id: int,
    faixa_id: int,
    data: FaixaUpdate,
) -> Faixa | None:
    faixa = await get_faixa(session, dojo_id, faixa_id)
    if faixa is None:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(faixa, key, value)
    await session.commit()
    await session.refresh(faixa)
    return faixa


async def delete_faixa(
    session: AsyncSession,
    dojo_id: int,
    faixa_id: int,
) -> bool:
    faixa = await get_faixa(session, dojo_id, faixa_id)
    if faixa is None:
        return False
    await session.delete(faixa)
    await session.commit()
    return True
