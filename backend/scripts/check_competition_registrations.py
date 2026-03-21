"""
Diagnóstico rápido: quantos registrations existem numa competição e quais statuses.
Uso (pasta backend):
  python -m scripts.check_competition_registrations --competition-id 1
"""

from __future__ import annotations

import argparse
import asyncio
from collections import Counter

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.competition import CompetitionRegistration
from app.models.faixa import Faixa
from app.models.student import Student


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--competition-id", type=int, required=True)
    args = parser.parse_args()

    async with AsyncSessionLocal() as session:
        r = await session.execute(
            select(CompetitionRegistration).where(
                CompetitionRegistration.competition_id == args.competition_id
            )
        )
        regs = r.scalars().all()
        print(f"[check] registrations_count={len(regs)}")

        statuses = Counter([x.status for x in regs])
        print(f"[check] statuses={dict(statuses)}")

        pay_statuses = Counter([x.payment_status for x in regs])
        print(f"[check] payment_statuses={dict(pay_statuses)}")

        weighed_null = sum(1 for x in regs if x.actual_weight_kg is None and x.weigh_in_at is None)
        print(f"[check] actual_weight_kg/weigh_in_at are null={weighed_null}")

        # conta faixa presente
        faixa_present = 0
        sampled = 0
        for x in regs[:10]:
            st = await session.get(Student, x.student_id)
            fid = st.faixa_id if st else None
            if fid is not None:
                faixa_present += 1
            sampled += 1
            fn = None
            if fid is not None:
                ff = await session.get(Faixa, fid)
                fn = ff.name if ff else None
            print(
                f"[check] reg_id={x.id} status={x.status} weight_class_id={x.weight_class_id} "
                f"student_faixa_id={fid} student_faixa_label={fn} actual_weight={x.actual_weight_kg}"
            )

        print(f"[check] faixa_present_in_first_{sampled}={faixa_present}")


if __name__ == "__main__":
    asyncio.run(main())

