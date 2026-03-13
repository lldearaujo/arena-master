import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User


SUPERADMIN_EMAIL = "superadmin@arenamaster.com"
SUPERADMIN_PASSWORD = "SuperAdmin123!"


async def main() -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.email == SUPERADMIN_EMAIL)
        )
        existing = result.scalar_one_or_none()

        if existing is not None:
            print(
                f"Usuário superadmin já existe: id={existing.id}, "
                f"email={existing.email}, role={existing.role}"
            )
            return

        user = User(
            email=SUPERADMIN_EMAIL,
            password_hash=get_password_hash(SUPERADMIN_PASSWORD),
            role="superadmin",
            dojo_id=None,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        print(
            f"SuperAdmin criado com sucesso: id={user.id}, "
            f"email={user.email}"
        )


if __name__ == "__main__":
    asyncio.run(main())

