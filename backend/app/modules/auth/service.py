from datetime import UTC, datetime

from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import (
    TokenData,
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
)
from app.models.student import Student
from app.models.user import User
from app.modules.auth.schemas import LoginRequest, RegisterStudentRequest, RoleLiteral, TokenPair, UserRead


async def authenticate_user(
    session: AsyncSession, email: str, password: str
) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user


async def login(session: AsyncSession, data: LoginRequest) -> TokenPair:
    user = await authenticate_user(session, data.email, data.password)
    if user is None:
        raise ValueError("Credenciais inválidas")

    access = create_access_token(str(user.id), user.role, user.dojo_id)
    refresh = create_refresh_token(str(user.id), user.role, user.dojo_id)
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        user=UserRead.model_validate(user),
    )


async def refresh_token(session: AsyncSession, token: str) -> TokenPair:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        token_data = TokenData(**payload)
        if token_data.type != "refresh":
            raise ValueError("Token inválido")
    except (JWTError, ValueError):
        raise ValueError("Token inválido ou expirado")

    result = await session.execute(
        select(User).where(User.id == int(token_data.sub))
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise ValueError("Usuário inválido")

    access = create_access_token(str(user.id), user.role, user.dojo_id)
    refresh = create_refresh_token(str(user.id), user.role, user.dojo_id)
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        user=UserRead.model_validate(user),
    )


async def register_student_user(
    session: AsyncSession,
    data: RegisterStudentRequest,
    allowed_dojo_id: int | None,
    allowed_roles: list[RoleLiteral],
) -> tuple[User, Student]:
    if data.role not in allowed_roles:
        raise ValueError("Papel não permitido")

    dojo_id = data.dojo_id
    if allowed_dojo_id is not None and dojo_id != allowed_dojo_id:
        raise ValueError("Dojo inválido para este usuário")

    existing_user = await session.execute(
        select(User).where(User.email == data.email)
    )
    if existing_user.scalar_one_or_none() is not None:
        raise ValueError("E-mail já cadastrado")

    password_hash = get_password_hash(data.password)

    user = User(
        email=data.email,
        password_hash=password_hash,
        role=data.role,
        dojo_id=dojo_id,
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(user)
    await session.flush()

    student = Student(
        dojo_id=dojo_id,
        name=data.name,
        email=data.email,
        user_id=user.id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(student)

    await session.commit()
    await session.refresh(user)
    await session.refresh(student)

    return user, student

