"""
Limpa chaves (brackets) e lutas (matches) de uma competição.

Deleta:
- competition_matches (via bracket_id)
- competition_brackets

Nao apaga:
- competition_registrations (atletas/inscrições)

Uso:
  python -m scripts.clear_competition_brackets --competition-id 1
Opcional:
  --dry-run (nao executa deleções)
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.models.competition import CompetitionBracket, CompetitionMatch


async def count_for_delete(session, competition_id: int) -> dict[str, int]:
    bracket_ids = (
        await session.execute(
            select(CompetitionBracket.id).where(CompetitionBracket.competition_id == competition_id)
        )
    ).scalars().all()

    matches_q = select(CompetitionMatch.id)
    if bracket_ids:
        matches_q = matches_q.where(CompetitionMatch.bracket_id.in_(bracket_ids))
    matches_count = (await session.execute(matches_q)).scalars().all()

    return {
        "brackets": len(bracket_ids),
        "matches": len(matches_count),
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--competition-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    async with AsyncSessionLocal() as session:
        before = await count_for_delete(session, args.competition_id)
        print(f"[clear-brackets] Antes: {before}")

        if args.dry_run:
            print("[clear-brackets] Dry run: nenhuma deleção executada.")
            return

        bracket_ids = (
            await session.execute(
                select(CompetitionBracket.id).where(CompetitionBracket.competition_id == args.competition_id)
            )
        ).scalars().all()

        if bracket_ids:
            await session.execute(delete(CompetitionMatch).where(CompetitionMatch.bracket_id.in_(bracket_ids)))

        await session.execute(delete(CompetitionBracket).where(CompetitionBracket.competition_id == args.competition_id))
        await session.commit()

        after = await count_for_delete(session, args.competition_id)
        print(f"[clear-brackets] Depois: {after}")


if __name__ == "__main__":
    asyncio.run(main())

