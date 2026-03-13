import asyncio

import asyncpg

from app.core.config import get_settings


async def main() -> None:
    settings = get_settings()
    print("DATABASE_URL:", settings.database_url)

    try:
        conn = await asyncpg.connect(settings.database_url)
    except Exception as exc:  # noqa: BLE001
        print("CONNECTION_ERROR:", type(exc).__name__, str(exc))
    else:
        print("CONNECTION_OK")
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

