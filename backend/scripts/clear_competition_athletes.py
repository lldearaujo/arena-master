"""
Limpa dados de atletas de uma competição (modo B):
- remove competition_registrations
- remove competition_brackets
- remove competition_matches

Isso NÃO apaga users/students/dojos.

Uso (pasta backend):
  python -m scripts.clear_competition_athletes --competition-id 1
Opcional:
  --dry-run (não executa deleções)
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.models.competition import CompetitionBracket, CompetitionMatch, CompetitionRegistration


async def count_for_delete(session, competition_id: int) -> dict[str, int]:
    bracket_ids = (
        await session.execute(
            select(CompetitionBracket.id).where(CompetitionBracket.competition_id == competition_id)
        )
    ).scalars().all()

    regs_count = (
        await session.execute(
            select(CompetitionRegistration.id).where(CompetitionRegistration.competition_id == competition_id)
        )
    ).scalars().all()
    regs_count_n = len(regs_count)

    matches_q = select(CompetitionMatch.id)
    if bracket_ids:
        matches_q = matches_q.where(CompetitionMatch.bracket_id.in_(bracket_ids))
    matches_count = (await session.execute(matches_q)).scalars().all()
    matches_count_n = len(matches_count)

    brackets_count = len(bracket_ids)
    return {
        "brackets": brackets_count,
        "matches": matches_count_n,
        "registrations": regs_count_n,
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--competition-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    async with AsyncSessionLocal() as session:
        before = await count_for_delete(session, args.competition_id)
        print(f"[clear] Antes: {before}")

        if args.dry_run:
            print("[clear] Dry run: nenhuma deleção executada.")
            return

        # Apaga matches primeiro (por segurança explícita).
        bracket_ids = (
            await session.execute(
                select(CompetitionBracket.id).where(CompetitionBracket.competition_id == args.competition_id)
            )
        ).scalars().all()

        if bracket_ids:
            await session.execute(delete(CompetitionMatch).where(CompetitionMatch.bracket_id.in_(bracket_ids)))

        await session.execute(delete(CompetitionBracket).where(CompetitionBracket.competition_id == args.competition_id))
        await session.execute(delete(CompetitionRegistration).where(CompetitionRegistration.competition_id == args.competition_id))
        await session.commit()

        after = await count_for_delete(session, args.competition_id)
        print(f"[clear] Depois: {after}")


if __name__ == "__main__":
    asyncio.run(main())

