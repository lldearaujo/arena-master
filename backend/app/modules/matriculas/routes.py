from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin
from app.models.user import User
from app.modules.matriculas import schemas, service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]


@router.post(
    "/links/generate",
    response_model=schemas.MatriculaLinkGenerateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_matricula_link(
    admin: AdminDep,
    session: SessionDep,
) -> schemas.MatriculaLinkGenerateResponse:
    if admin.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário admin sem dojo vinculado",
        )
    link = await service.generate_link(session, admin.dojo_id)
    return schemas.MatriculaLinkGenerateResponse(token=link.token)


@router.get("/{token}/form", response_model=schemas.MatriculaFormResponse)
async def get_matricula_form(
    token: str,
    session: SessionDep,
) -> schemas.MatriculaFormResponse:
    try:
        dojo_read, plans, modalidades, faixas = await service.get_public_form_data(
            session, token
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    plans_read = [schemas.PlanRead.model_validate(p) for p in plans]
    return schemas.MatriculaFormResponse(
        dojo=dojo_read,
        plans=plans_read,
        modalidades=modalidades,
        faixas=faixas,
    )


@router.post(
    "/{token}/submit",
    response_model=schemas.MatriculaSubmitResponse,
)
async def submit_matricula(
    token: str,
    payload: schemas.MatriculaSubmitRequest,
    session: SessionDep,
) -> schemas.MatriculaSubmitResponse:
    try:
        return await service.submit_matricula(session, token, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

