from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dojo_modalidade import DojoModalidade
from app.models.faixa import Faixa
from app.modules.faixas.schemas import FaixaCreate, FaixaRead, FaixaUpdate


async def _modalidade_belongs_to_dojo(
    session: AsyncSession, dojo_id: int, modalidade_id: int
) -> bool:
    dm = await session.get(DojoModalidade, modalidade_id)
    return dm is not None and dm.dojo_id == dojo_id


async def list_faixas_read(
    session: AsyncSession,
    dojo_id: int,
    modalidade_id: int | None = None,
) -> list[FaixaRead]:
    stmt = (
        select(Faixa, DojoModalidade.name)
        .join(DojoModalidade, Faixa.modalidade_id == DojoModalidade.id)
        .where(Faixa.dojo_id == dojo_id)
        .order_by(DojoModalidade.name, Faixa.ordem, Faixa.id)
    )
    if modalidade_id is not None:
        stmt = stmt.where(Faixa.modalidade_id == modalidade_id)
    result = await session.execute(stmt)
    out: list[FaixaRead] = []
    for f, mname in result.all():
        out.append(
            FaixaRead(
                id=f.id,
                dojo_id=f.dojo_id,
                modalidade_id=f.modalidade_id,
                modalidade_name=mname,
                name=f.name,
                ordem=f.ordem,
                max_graus=f.max_graus,
                exibir_como_dan=bool(f.exibir_como_dan),
            )
        )
    return out


async def get_faixa_read(
    session: AsyncSession,
    dojo_id: int,
    faixa_id: int,
) -> FaixaRead | None:
    result = await session.execute(
        select(Faixa, DojoModalidade.name)
        .join(DojoModalidade, Faixa.modalidade_id == DojoModalidade.id)
        .where(
            Faixa.id == faixa_id,
            Faixa.dojo_id == dojo_id,
        )
    )
    row = result.one_or_none()
    if row is None:
        return None
    f, mname = row
    return FaixaRead(
        id=f.id,
        dojo_id=f.dojo_id,
        modalidade_id=f.modalidade_id,
        modalidade_name=mname,
        name=f.name,
        ordem=f.ordem,
        max_graus=f.max_graus,
        exibir_como_dan=bool(f.exibir_como_dan),
    )


async def create_faixa(
    session: AsyncSession,
    dojo_id: int,
    data: FaixaCreate,
) -> FaixaRead:
    if not await _modalidade_belongs_to_dojo(session, dojo_id, data.modalidade_id):
        raise ValueError("Modalidade inválida para este dojo")
    faixa = Faixa(
        dojo_id=dojo_id,
        modalidade_id=data.modalidade_id,
        name=data.name,
        ordem=data.ordem,
        max_graus=data.max_graus,
        exibir_como_dan=data.exibir_como_dan,
    )
    session.add(faixa)
    await session.commit()
    await session.refresh(faixa)
    read = await get_faixa_read(session, dojo_id, faixa.id)
    assert read is not None
    return read


async def update_faixa(
    session: AsyncSession,
    dojo_id: int,
    faixa_id: int,
    data: FaixaUpdate,
) -> FaixaRead | None:
    faixa = await session.get(Faixa, faixa_id)
    if faixa is None or faixa.dojo_id != dojo_id:
        return None
    dump = data.model_dump(exclude_unset=True)
    if "modalidade_id" in dump and dump["modalidade_id"] is not None:
        mid = int(dump["modalidade_id"])
        if not await _modalidade_belongs_to_dojo(session, dojo_id, mid):
            raise ValueError("Modalidade inválida para este dojo")
    for key, value in dump.items():
        setattr(faixa, key, value)
    await session.commit()
    await session.refresh(faixa)
    return await get_faixa_read(session, dojo_id, faixa_id)


async def delete_faixa(
    session: AsyncSession,
    dojo_id: int,
    faixa_id: int,
) -> bool:
    faixa = await session.get(Faixa, faixa_id)
    if faixa is None or faixa.dojo_id != dojo_id:
        return False
    await session.delete(faixa)
    await session.commit()
    return True
