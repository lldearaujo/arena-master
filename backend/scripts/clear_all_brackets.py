"""Apaga todas as chaves e lutas (todas as competições). Não apaga inscrições."""
from __future__ import annotations

import asyncio

from sqlalchemy import delete, func, select

from app.core.database import AsyncSessionLocal
from app.models.competition import CompetitionBracket, CompetitionMatch


async def main() -> None:
    async with AsyncSessionLocal() as s:
        b0 = int((await s.execute(select(func.count()).select_from(CompetitionBracket))).scalar_one())
        m0 = int((await s.execute(select(func.count()).select_from(CompetitionMatch))).scalar_one())
        print(f"[clear-all] Antes: brackets={b0}, matches={m0}")
        await s.execute(delete(CompetitionMatch))
        await s.execute(delete(CompetitionBracket))
        await s.commit()
        b1 = int((await s.execute(select(func.count()).select_from(CompetitionBracket))).scalar_one())
        m1 = int((await s.execute(select(func.count()).select_from(CompetitionMatch))).scalar_one())
        print(f"[clear-all] Depois: brackets={b1}, matches={m1}")


if __name__ == "__main__":
    asyncio.run(main())
