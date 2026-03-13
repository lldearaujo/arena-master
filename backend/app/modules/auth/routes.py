from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin
from app.models.user import User
from app.modules.auth import schemas, service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]


@router.post("/login", response_model=schemas.TokenPair)
async def login(
    payload: schemas.LoginRequest,
    session: SessionDep,
) -> schemas.TokenPair:
    try:
        return await service.login(session, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.post("/refresh", response_model=schemas.TokenPair)
async def refresh(
    payload: schemas.TokenRefreshRequest,
    session: SessionDep,
) -> schemas.TokenPair:
    try:
        return await service.refresh_token(session, payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.post(
    "/register-student",
    response_model=schemas.UserRead,
    status_code=status.HTTP_201_CREATED,
)
async def register_student(
    payload: schemas.RegisterStudentRequest,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.UserRead:
    try:
        user, _ = await service.register_student_user(
            session,
            payload,
            allowed_dojo_id=admin.dojo_id,
            allowed_roles=["aluno"],
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return schemas.UserRead.model_validate(user)

