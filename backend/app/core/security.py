from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


class TokenData(BaseModel):
    sub: str
    role: Literal["superadmin", "admin", "aluno"]
    dojo_id: int | None = None
    type: Literal["access", "refresh"]


def _create_token(data: dict[str, Any], expires_delta: timedelta, token_type: str) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(UTC) + expires_delta
    to_encode.update({"exp": expire, "type": token_type})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, role: str, dojo_id: int | None) -> str:
    settings = get_settings()
    return _create_token(
        {"sub": subject, "role": role, "dojo_id": dojo_id},
        timedelta(minutes=settings.jwt_access_token_expires_minutes),
        token_type="access",
    )


def create_refresh_token(subject: str, role: str, dojo_id: int | None) -> str:
    settings = get_settings()
    return _create_token(
        {"sub": subject, "role": role, "dojo_id": dojo_id},
        timedelta(days=settings.jwt_refresh_token_expires_days),
        token_type="refresh",
    )


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> User:
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        token_data = TokenData(**payload)
        if token_data.type != "access":
            raise credentials_exception
    except (JWTError, ValueError):
        raise credentials_exception

    result = await session.execute(
        select(User).where(User.id == int(token_data.sub))
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def get_current_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != "admin" or user.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores de dojo",
        )
    return user


async def require_superadmin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito ao SuperAdmin",
        )
    return user

