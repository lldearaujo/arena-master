from datetime import UTC, datetime

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.user import User
from app.modules.superadmin.schemas import ProfessorCreate, ProfessorUpdate


async def list_professores(session: AsyncSession, dojo_id: int) -> list[User]:
    result = await session.execute(
        select(User)
        .where(and_(User.dojo_id == dojo_id, User.role == "admin"))
        .order_by(User.id)
    )
    return list(result.scalars().all())


async def get_professor(
    session: AsyncSession, dojo_id: int, user_id: int
) -> User | None:
    result = await session.execute(
        select(User).where(
            and_(
                User.id == user_id,
                User.dojo_id == dojo_id,
                User.role == "admin",
            )
        )
    )
    return result.scalar_one_or_none()


async def create_professor(
    session: AsyncSession, dojo_id: int, data: ProfessorCreate
) -> User:
    existing = await session.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none() is not None:
        raise ValueError("E-mail já cadastrado")

    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        role="admin",
        dojo_id=dojo_id,
        is_active=True,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def update_professor(
    session: AsyncSession, dojo_id: int, user_id: int, data: ProfessorUpdate
) -> User | None:
    user = await get_professor(session, dojo_id, user_id)
    if user is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))
    for key in ("email", "is_active"):
        if key in update_data:
            setattr(user, key, update_data[key])
    if "password_hash" in update_data:
        setattr(user, "password_hash", update_data["password_hash"])
    user.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(user)
    return user


async def delete_professor(
    session: AsyncSession, dojo_id: int, user_id: int
) -> bool:
    user = await get_professor(session, dojo_id, user_id)
    if user is None:
        return False
    await session.delete(user)
    await session.commit()
    return True
