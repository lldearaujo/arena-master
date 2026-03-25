from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    modalidade_id: int | None = Query(
        None, description="Filtra faixas desta modalidade (dojo_modalidades.id)"
    ),
) -> list[schemas.FaixaRead]:
    if admin.dojo_id is None:
        return []
    return await service.list_faixas_read(session, admin.dojo_id, modalidade_id)


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
    try:
        return await service.create_faixa(session, admin.dojo_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get("/{faixa_id}", response_model=schemas.FaixaRead)
async def get_faixa(
    faixa_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.FaixaRead:
    if admin.dojo_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dojo não definido")
    faixa = await service.get_faixa_read(session, admin.dojo_id, faixa_id)
    if faixa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faixa não encontrada")
    return faixa


@router.put("/{faixa_id}", response_model=schemas.FaixaRead)
async def update_faixa(
    faixa_id: int,
    payload: schemas.FaixaUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.FaixaRead:
    if admin.dojo_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dojo não definido")
    try:
        faixa = await service.update_faixa(session, admin.dojo_id, faixa_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if faixa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Faixa não encontrada")
    return faixa


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
