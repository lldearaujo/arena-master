from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin
from app.models.user import User
from app.modules.modalidades import schemas, service

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]


@router.get("/", response_model=list[schemas.ModalidadeListaItem])
async def list_modalidades(
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.ModalidadeListaItem]:
    if admin.dojo_id is None:
        return []
    unified = await service.list_modalidades_unificadas(session, admin.dojo_id)
    return [
        schemas.ModalidadeListaItem(
            id=i,
            name=n,
            em_catalogo=c,
            has_graduation_system=h,
            skills_labels=sl,
        )
        for i, n, c, h, sl in unified
    ]


@router.put("/por-nome", status_code=status.HTTP_204_NO_CONTENT)
async def renomear_modalidade_por_nome(
    payload: schemas.ModalidadeRenamePorNome,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    if admin.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dojo não definido",
        )
    try:
        await service.rename_modalidade_por_nome(
            session,
            admin.dojo_id,
            payload.old_name,
            payload.new_name,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.delete("/por-nome", status_code=status.HTTP_204_NO_CONTENT)
async def limpar_modalidade_por_nome(
    admin: AdminDep,
    session: SessionDep,
    name: str = Query(..., min_length=1, max_length=64),
) -> None:
    if admin.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dojo não definido",
        )
    nome = name.strip()
    if not nome:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nome inválido",
        )
    await service.limpar_modalidade_por_nome(session, admin.dojo_id, nome)


@router.post(
    "/",
    response_model=schemas.ModalidadeRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_modalidade(
    payload: schemas.ModalidadeCreate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.ModalidadeRead:
    if admin.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dojo não definido",
        )
    try:
        row = await service.create_modalidade(session, admin.dojo_id, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return schemas.ModalidadeRead.model_validate(row)


@router.put("/{modalidade_id:int}", response_model=schemas.ModalidadeRead)
async def update_modalidade(
    modalidade_id: int,
    payload: schemas.ModalidadeUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.ModalidadeRead:
    if admin.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dojo não definido",
        )
    try:
        row = await service.update_modalidade(
            session, admin.dojo_id, modalidade_id, payload
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modalidade não encontrada",
        )
    return schemas.ModalidadeRead.model_validate(row)


@router.delete("/{modalidade_id:int}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_modalidade(
    modalidade_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    if admin.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dojo não definido",
        )
    try:
        ok = await service.delete_modalidade(session, admin.dojo_id, modalidade_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Modalidade não encontrada",
        )
