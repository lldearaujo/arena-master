from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin
from app.models.user import User
from app.modules.faixas import schemas, service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]


@router.get("/", response_model=list[schemas.FaixaRead])
async def list_faixas(
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.FaixaRead]:
    if admin.dojo_id is None:
        return []
    faixas = await service.list_faixas(session, admin.dojo_id)
    return [schemas.FaixaRead.model_validate(f) for f in faixas]


@router.post(
    "/",
    response_model=schemas.FaixaRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_faixa(
    payload: schemas.FaixaCreate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.FaixaRead:
    if admin.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dojo não definido",
        )
    faixa = await service.create_faixa(session, admin.dojo_id, payload)
    return schemas.FaixaRead.model_validate(faixa)


@router.get("/{faixa_id}", response_model=schemas.FaixaRead)
async def get_faixa(
    faixa_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.FaixaRead:
    if admin.dojo_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dojo não definido")
    faixa = await service.get_faixa(session, admin.dojo_id, faixa_id)
    if faixa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faixa não encontrada")
    return schemas.FaixaRead.model_validate(faixa)


@router.put("/{faixa_id}", response_model=schemas.FaixaRead)
async def update_faixa(
    faixa_id: int,
    payload: schemas.FaixaUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.FaixaRead:
    if admin.dojo_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dojo não definido")
    faixa = await service.update_faixa(session, admin.dojo_id, faixa_id, payload)
    if faixa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faixa não encontrada")
    return schemas.FaixaRead.model_validate(faixa)


@router.delete("/{faixa_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faixa(
    faixa_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    if admin.dojo_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dojo não definido")
    deleted = await service.delete_faixa(session, admin.dojo_id, faixa_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faixa não encontrada")
