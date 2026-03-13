from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user, require_superadmin
from app.models.user import User
from app.modules.dojos import schemas, service


router = APIRouter()


SessionDep = Annotated[AsyncSession, Depends(get_session)]
SuperAdminDep = Annotated[User, Depends(require_superadmin)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]


@router.get("/me", response_model=schemas.DojoRead)
async def get_my_dojo(
    current_user: CurrentUserDep,
    session: SessionDep,
) -> schemas.DojoRead:
    if current_user.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário não está vinculado a um dojo",
        )

    dojo = await service.get_dojo(session, current_user.dojo_id)
    if dojo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dojo não encontrado")
    return schemas.DojoRead.model_validate(dojo)


@router.get("/", response_model=list[schemas.DojoRead])
async def list_dojos(
    _: SuperAdminDep,
    session: SessionDep,
) -> list[schemas.DojoRead]:
    dojos = await service.list_dojos(session)
    return [schemas.DojoRead.model_validate(dojo) for dojo in dojos]


@router.get("/{dojo_id}", response_model=schemas.DojoRead)
async def get_dojo(
    dojo_id: int,
    _: SuperAdminDep,
    session: SessionDep,
) -> schemas.DojoRead:
    dojo = await service.get_dojo(session, dojo_id)
    if dojo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dojo não encontrado")
    return schemas.DojoRead.model_validate(dojo)


@router.post("/", response_model=schemas.DojoRead, status_code=status.HTTP_201_CREATED)
async def create_dojo(
    payload: schemas.DojoCreate,
    _: SuperAdminDep,
    session: SessionDep,
) -> schemas.DojoRead:
    dojo = await service.create_dojo(session, payload)
    return schemas.DojoRead.model_validate(dojo)


@router.put("/{dojo_id}", response_model=schemas.DojoRead)
async def update_dojo(
    dojo_id: int,
    payload: schemas.DojoUpdate,
    _: SuperAdminDep,
    session: SessionDep,
) -> schemas.DojoRead:
    dojo = await service.update_dojo(session, dojo_id, payload)
    if dojo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dojo não encontrado")
    return schemas.DojoRead.model_validate(dojo)


@router.delete("/{dojo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dojo(
    dojo_id: int,
    _: SuperAdminDep,
    session: SessionDep,
) -> None:
    deleted = await service.delete_dojo(session, dojo_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dojo não encontrado")

