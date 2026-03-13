import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.user import User


async def main() -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()

    if not users:
        print("Nenhum usuário encontrado.")
        return

    for user in users:
        print(
            f"id={user.id}, email={user.email}, role={user.role}, "
            f"dojo_id={user.dojo_id}, is_active={user.is_active}"
        )


if __name__ == "__main__":
    asyncio.run(main())

