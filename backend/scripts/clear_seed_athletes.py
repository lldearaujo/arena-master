"""
Limpa atletas criados pelo seed (identificados pelo padrão de e-mail @seed.local):
- remove competition_registrations associadas
- remove competition_brackets / competition_matches associados
- remove students e users com email @seed.local

NÃO afeta alunos reais (com e-mails fora do padrão seed).

Uso (pasta backend):
  python -m scripts.clear_seed_athletes
  python -m scripts.clear_seed_athletes --dry-run
"""

from __future__ import annotations

import argparse
import asyncio

from sqlalchemy import delete, select

from app.core.database import AsyncSessionLocal
from app.models.competition import CompetitionBracket, CompetitionMatch, CompetitionRegistration
from app.models.student import Student
from app.models.user import User


SEED_EMAIL_SUFFIX = "@seed.local"


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Mostra o que seria deletado sem executar")
    args = parser.parse_args()

    async with AsyncSessionLocal() as session:
        # ── Busca users/students seed ──────────────────────────────────────────
        seed_users = list(
            (await session.execute(
                select(User).where(User.email.like(f"%{SEED_EMAIL_SUFFIX}"))
            )).scalars().all()
        )
        seed_user_ids = [u.id for u in seed_users]

        seed_students = list(
            (await session.execute(
                select(Student).where(Student.email.like(f"%{SEED_EMAIL_SUFFIX}"))
            )).scalars().all()
        )
        seed_student_ids = [s.id for s in seed_students]

        # ── Inscrições associadas aos students seed ────────────────────────────
        regs = list(
            (await session.execute(
                select(CompetitionRegistration).where(
                    CompetitionRegistration.student_id.in_(seed_student_ids)
                )
            )).scalars().all()
        ) if seed_student_ids else []
        reg_ids = [r.id for r in regs]

        # ── Brackets / Matches a limpar (inferidos dos regs) ──────────────────
        affected_comp_ids = list({r.competition_id for r in regs})
        bracket_ids: list[int] = []
        if affected_comp_ids:
            bracket_ids = list(
                (await session.execute(
                    select(CompetitionBracket.id).where(
                        CompetitionBracket.competition_id.in_(affected_comp_ids)
                    )
                )).scalars().all()
            )

        print(f"[clear-seed] Seed users encontrados:    {len(seed_users)}")
        print(f"[clear-seed] Seed students encontrados: {len(seed_students)}")
        print(f"[clear-seed] Inscrições afetadas:       {len(regs)}")
        print(f"[clear-seed] Brackets afetados:         {len(bracket_ids)}")

        if args.dry_run:
            print("[clear-seed] --dry-run: nenhuma deleção executada.")
            return

        # ── Deleções em ordem segura ───────────────────────────────────────────
        if bracket_ids:
            r = await session.execute(
                delete(CompetitionMatch).where(CompetitionMatch.bracket_id.in_(bracket_ids))
            )
            print(f"[clear-seed] Matches deletados:  {r.rowcount}")

            r = await session.execute(
                delete(CompetitionBracket).where(CompetitionBracket.id.in_(bracket_ids))
            )
            print(f"[clear-seed] Brackets deletados: {r.rowcount}")

        if reg_ids:
            r = await session.execute(
                delete(CompetitionRegistration).where(CompetitionRegistration.id.in_(reg_ids))
            )
            print(f"[clear-seed] Inscrições deletadas: {r.rowcount}")

        if seed_student_ids:
            r = await session.execute(
                delete(Student).where(Student.id.in_(seed_student_ids))
            )
            print(f"[clear-seed] Students deletados: {r.rowcount}")

        if seed_user_ids:
            r = await session.execute(
                delete(User).where(User.id.in_(seed_user_ids))
            )
            print(f"[clear-seed] Users deletados:    {r.rowcount}")

        await session.commit()
        print("[clear-seed] Concluído.")


if __name__ == "__main__":
    asyncio.run(main())
