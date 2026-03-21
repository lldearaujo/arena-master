"""
Seed de atletas (users/students) e inscrições numa competição, para testar o resto do fluxo.

Uso (pasta backend):
  python -m scripts.seed_competition_athletes --competition-id 1 --count 24 --pre-weigh-in

Notas:
- O script NÃO deleta nada. Ele só adiciona registros.
- Para inscrições públicas (sem faixa cadastrada), este script assume atletas com `faixa_id` (graduação) do dojo do organizador.
- Ao usar `--pre-weigh-in`, o script tenta escolher um `actual_weight_kg` compatível com a categoria de peso do atleta.
"""

from __future__ import annotations

import argparse
import asyncio
import random
import secrets
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.competition import (
    CompetitionAgeDivision,
    CompetitionBeltEligibility,
    CompetitionRegistration,
    CompetitionWeightClass,
)
from app.models.faixa import Faixa
from app.models.student import Student
from app.models.user import User


REG_STATUS_WEIGHED_IN = "weighed_in"
REG_STATUS_DISQUALIFIED = "disqualified"

PAY_NOT_APPLICABLE = "not_applicable"
PAY_CONFIRMED = "confirmed"


def _reg_code() -> str:
    # 8 hex chars
    return secrets.token_hex(4)


@dataclass(frozen=True)
class Combo:
    age_division_id: int
    gender: str


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--competition-id", type=int, required=True)
    parser.add_argument("--count", type=int, default=24)
    parser.add_argument(
        "--payment-status",
        type=str,
        default=PAY_CONFIRMED,
        choices=[PAY_CONFIRMED, PAY_NOT_APPLICABLE],
    )
    parser.add_argument("--pre-weigh-in", action="store_true", help="Marca registros como weighed_in e preenche peso.")
    parser.add_argument(
        "--disqualified-rate",
        type=float,
        default=0.0,
        help="Apenas se --pre-weigh-in: percentagem (0..1) de atletas marcados como disqualified.",
    )
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    if args.count <= 0:
        raise SystemExit("--count precisa ser > 0")
    if not (0.0 <= args.disqualified_rate <= 1.0):
        raise SystemExit("--disqualified-rate precisa estar entre 0 e 1")

    rng = random.Random(args.seed or None)

    async with AsyncSessionLocal() as session:
        # 1) Carrega age divisions / weight classes
        wclasses = list(
            (await session.execute(
                select(CompetitionWeightClass).where(CompetitionWeightClass.competition_id == args.competition_id)
            )).scalars().all()
        )
        if not wclasses:
            raise SystemExit("Não existem weight classes para esta competição.")

        # 2) Carrega belt eligibility
        belts = list(
            (await session.execute(
                select(CompetitionBeltEligibility).where(
                    CompetitionBeltEligibility.competition_id == args.competition_id
                )
            )).scalars().all()
        )
        if not belts:
            raise SystemExit("Não existem belt eligibility para esta competição.")

        belts_by_combo: dict[Combo, list[CompetitionBeltEligibility]] = {}
        for b in belts:
            combo = Combo(age_division_id=b.age_division_id, gender=b.gender)
            belts_by_combo.setdefault(combo, []).append(b)

        # Pré-carrega faixas para evitar query por atleta.
        faixa_ids = {b.faixa_id for b in belts}
        faixas_map: dict[int, Faixa] = {}
        if faixa_ids:
            faixas_rows = (
                await session.execute(select(Faixa).where(Faixa.id.in_(faixa_ids)))
            ).scalars().all()
            faixas_map = {f.id: f for f in faixas_rows}

        # 3) Filtra weight classes com belt eligibility compatível
        eligible_wclasses: list[CompetitionWeightClass] = []
        for wc in wclasses:
            combo = Combo(age_division_id=wc.age_division_id, gender=wc.gender)
            if combo in belts_by_combo:
                eligible_wclasses.append(wc)

        if not eligible_wclasses:
            raise SystemExit(
                "Não foi possível encontrar weight classes compatíveis com belt eligibility (faixas)."
            )

        # 4) Para gerar idades válidas, precisamos do range de cada age division
        age_divs = list(
            (await session.execute(
                select(CompetitionAgeDivision).where(
                    CompetitionAgeDivision.competition_id == args.competition_id
                )
            )).scalars().all()
        )
        age_by_id = {ad.id: ad for ad in age_divs}

        # 5) Distribuir entre TODAS as categorias (todas as weight_classes elegíveis).
        # Como você pediu "todas as categorias", não sub-amostramos.
        chosen_wclasses = list(eligible_wclasses)
        per_class: list[int] = []
        num_classes = max(1, len(chosen_wclasses))
        base = args.count // num_classes
        rem = args.count % num_classes
        for i in range(len(chosen_wclasses)):
            per_class.append(base + (1 if i < rem else 0))

        # 6) Cria alunos + inscrições em blocos (para não ficar lento/travado).
        created_regs = 0
        now = datetime.now(timezone.utc)

        password_hash = get_password_hash("SeedPass123!")
        chunk_size = 50

        pending_users: list[User] = []
        pending_students_meta: list[dict[str, object]] = []

        async def flush_chunk() -> None:
            nonlocal created_regs
            if not pending_users:
                return

            session.add_all(pending_users)
            await session.flush()  # users -> user.id

            # students (precisa de student.id para competitions_registrations)
            students: list[Student] = []
            regs: list[CompetitionRegistration] = []

            for user, meta in zip(pending_users, pending_students_meta):
                student = Student(
                    dojo_id=None,
                    name=str(meta["student_name"]),
                    email=str(meta["email"]),
                    phone=None,
                    birth_date=meta["birth_dt"],  # type: ignore[arg-type]
                    user_id=user.id,
                    faixa_id=int(meta["faixa_id"]),
                    grau=0,
                    modalidade=None,
                    notes=None,
                    external_dojo_name=None,
                    external_faixa_label=None,
                    created_at=now,
                    updated_at=now,
                )
                students.append(student)

            session.add_all(students)
            await session.flush()  # students -> student.id

            for student, meta in zip(students, pending_students_meta):
                reg = CompetitionRegistration(
                    competition_id=args.competition_id,
                    student_id=student.id,
                    gender=str(meta["gender"]),
                    age_division_id=int(meta["age_division_id"]),
                    weight_class_id=int(meta["weight_class_id"]),
                    status=str(meta["status"]),
                    declared_weight_kg=meta["declared_weight_kg"],  # type: ignore[arg-type]
                    actual_weight_kg=meta["actual_weight_kg"],  # type: ignore[arg-type]
                    registration_public_code=str(meta["registration_public_code"]),
                    ranking_points=0.0,
                    weigh_in_at=meta["weigh_in_at"],  # type: ignore[arg-type]
                    weigh_in_notes=None,
                    payment_status=args.payment_status,
                    payment_receipt_path=None,
                    payment_notes=None,
                    payment_confirmed_at=now
                    if args.payment_status == PAY_CONFIRMED
                    else None,
                    created_at=now,
                    updated_at=now,
                )
                regs.append(reg)

            session.add_all(regs)
            created_regs += len(regs)
            print(f"[seed] Inseridos: {created_regs}/{args.count}", flush=True)

            # limpa buffers
            pending_users.clear()
            pending_students_meta.clear()

        for wc, n_at in zip(chosen_wclasses, per_class):
            combo = Combo(age_division_id=wc.age_division_id, gender=wc.gender)
            belt_list = belts_by_combo[combo]
            ad = age_by_id.get(wc.age_division_id)
            if ad is None:
                continue

            for _ in range(n_at):
                b = rng.choice(belt_list)
                faixa_id = b.faixa_id
                if faixa_id not in faixas_map:
                    continue

                birth_year = rng.randint(ad.birth_year_min, ad.birth_year_max)
                birth_dt = date(birth_year, 7, 1)

                email = f"seed_athlete_{args.competition_id}_{faixa_id}_{secrets.token_hex(4)}@seed.local".lower()
                user = User(
                    email=email,
                    password_hash=password_hash,
                    role="aluno",
                    dojo_id=None,
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                    name=f"Seed Athlete {email.split('@')[0]}",
                )

                declared_weight = None
                actual_weight = None
                status = "registered"
                weigh_in_at = None

                if wc.max_weight_kg is not None:
                    declared_weight = round(wc.max_weight_kg * rng.uniform(0.6, 0.99), 2)
                    if args.pre_weigh_in:
                        base = wc.max_weight_kg * rng.uniform(0.6, 0.99)
                        actual_weight = round(base, 2)
                        status = REG_STATUS_WEIGHED_IN
                        if rng.random() < args.disqualified_rate:
                            actual_weight = round(wc.max_weight_kg + rng.uniform(0.02, 2.0), 2)
                            actual_weight = max(actual_weight, 0.01)
                            status = REG_STATUS_DISQUALIFIED
                        weigh_in_at = now
                else:
                    declared_weight = round(rng.uniform(50, 110), 2)
                    if args.pre_weigh_in:
                        actual_weight = round(rng.uniform(50, 110), 2)
                        status = REG_STATUS_WEIGHED_IN
                        weigh_in_at = now

                pending_users.append(user)
                pending_students_meta.append(
                    {
                        "student_name": user.name or f"Seed Athlete {user.id}",
                        "email": email,
                        "birth_dt": birth_dt,
                        "faixa_id": faixa_id,
                        "gender": wc.gender,
                        "age_division_id": wc.age_division_id,
                        "weight_class_id": wc.id,
                        "status": status,
                        "declared_weight_kg": declared_weight,
                        "actual_weight_kg": actual_weight,
                        "registration_public_code": _reg_code(),
                        "weigh_in_at": weigh_in_at,
                    }
                )

                if len(pending_users) >= chunk_size:
                    await flush_chunk()

        # flush do que sobrou
        await flush_chunk()
        await session.commit()
        print(f"Seed finalizado. Inscrições criadas: {created_regs}")


if __name__ == "__main__":
    asyncio.run(main())

