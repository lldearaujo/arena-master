"""
Seed "completo" para uma competição:
- Cria users/students/competition_registrations
- Objetivos (para teste de fluxo):
  - pelo menos N inscrições com payment_status="confirmed"
  - pelo menos M inscrições com status="registered" (ainda não pesados)
  - o restante: status="weighed_in" com actual_weight_kg compatível com a categoria

Também tenta cobrir:
- todas as weight_classes (categorias de peso)
- todas as belt eligibilities (faixas permitidas por divisão/gênero)

Uso:
  python -m scripts.seed_competition_full_inscriptions --competition-id 1 --count 530 --confirmed-count 500 --non-weighed-count 30
"""

from __future__ import annotations

import argparse
import asyncio
import random
import secrets
from dataclasses import dataclass
from datetime import date, datetime, timezone

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
from app.models.dojo import Dojo
from app.models.student import Student
from app.models.user import User


PAY_CONFIRMED = "confirmed"
STATUS_REGISTERED = "registered"
STATUS_WEIGHED_IN = "weighed_in"


FIRST_NAMES_M = [
    "Arthur",
    "Bernardo",
    "Caio",
    "Daniel",
    "Eduardo",
    "Felipe",
    "Gabriel",
    "Henrique",
    "Igor",
    "Joao",
    "Kauã",
    "Lucas",
    "Mateus",
    "Nicolas",
    "Otavio",
    "Pedro",
    "Rafael",
    "Samuel",
    "Thiago",
    "Victor",
    "William",
]
FIRST_NAMES_F = [
    "Ana",
    "Beatriz",
    "Carolina",
    "Daniela",
    "Eduarda",
    "Fernanda",
    "Giovana",
    "Helena",
    "Isabela",
    "Juliana",
    "Karen",
    "Larissa",
    "Mariana",
    "Nathalia",
    "Olivia",
    "Patricia",
    "Renata",
    "Sofia",
    "Tais",
    "Vanessa",
    "Wendy",
]
LAST_NAMES = [
    "Almeida",
    "Barbosa",
    "Carvalho",
    "Costa",
    "Dias",
    "Ferreira",
    "Gomes",
    "Henriques",
    "Ibrahim",
    "Junior",
    "Klein",
    "Lima",
    "Machado",
    "Nogueira",
    "Oliveira",
    "Pereira",
    "Queiroz",
    "Ribeiro",
    "Santos",
    "Teixeira",
    "Uma",
    "Vasconcelos",
    "Xavier",
    "Yamamoto",
    "Zanetti",
]


def _reg_code() -> str:
    return secrets.token_hex(4)


def _pick_name(gender: str, rng: random.Random) -> tuple[str, str]:
    if gender == "female":
        fn = rng.choice(FIRST_NAMES_F)
    else:
        fn = rng.choice(FIRST_NAMES_M)
    ln = rng.choice(LAST_NAMES)
    # normaliza caracteres especiais comuns
    return fn.replace("ã", "a").replace("õ", "o").replace("é", "e"), ln


@dataclass(frozen=True)
class Spec:
    age_division_id: int
    gender: str
    weight_class_id: int
    faixa_id: int


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--competition-id", type=int, required=True)
    parser.add_argument("--count", type=int, required=True)
    parser.add_argument("--confirmed-count", type=int, required=True)
    parser.add_argument("--non-weighed-count", type=int, required=True)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    if args.count <= 0:
        raise SystemExit("--count precisa ser > 0")
    if args.confirmed_count < 0 or args.confirmed_count > args.count:
        raise SystemExit("--confirmed-count precisa estar entre 0 e --count")
    if args.non_weighed_count < 0 or args.non_weighed_count > args.count:
        raise SystemExit("--non-weighed-count precisa estar entre 0 e --count")
    if args.non_weighed_count + args.confirmed_count < args.count:
        # Isso não é uma proibição real (porque não-confirmed pode existir com status registered/weighed),
        # mas mantemos uma regra simples: queremos pelo menos confirmed_count com pagamento confirmado.
        pass

    rng = random.Random(args.seed or None)
    now = datetime.now(timezone.utc)
    password_hash = get_password_hash("SeedPass123!")

    async with AsyncSessionLocal() as session:
        competition_id = args.competition_id

        # Carrega weight classes
        wclasses = list(
            (await session.execute(
                select(CompetitionWeightClass).where(CompetitionWeightClass.competition_id == competition_id)
            )).scalars().all()
        )
        # Não considerar classes "absolutas" de GI (sem teto) para geração.
        wclasses = [
            wc
            for wc in wclasses
            if not (
                wc.modality == "gi"
                and wc.max_weight_kg is None
                and "categoria unica" in (wc.label or "").strip().lower()
            )
        ]
        if not wclasses:
            raise SystemExit("Não existem weight classes para esta competição.")

        # Carrega age divisions
        age_divs = list(
            (await session.execute(
                select(CompetitionAgeDivision).where(CompetitionAgeDivision.competition_id == competition_id)
            )).scalars().all()
        )
        age_by_id = {ad.id: ad for ad in age_divs}

        # Carrega belt eligibility
        belts = list(
            (await session.execute(
                select(CompetitionBeltEligibility).where(CompetitionBeltEligibility.competition_id == competition_id)
            )).scalars().all()
        )
        if not belts:
            raise SystemExit("Não existem belt eligibility para esta competição.")

        # Carrega faixas apenas para garantir que os ids existem
        faixa_ids = {b.faixa_id for b in belts}
        faixas_rows = (
            await session.execute(select(Faixa).where(Faixa.id.in_(faixa_ids)))
        ).scalars().all()
        faixa_ids_ok = {f.id for f in faixas_rows}

        # Carrega dojos para usar como "equipe externa" dos atletas gerados (só o nome, sem FK).
        dojos = list((await session.execute(select(Dojo))).scalars().all())
        if not dojos:
            raise SystemExit("Não existem dojos cadastrados para usar como equipes dos atletas.")

        # Index belt eligibilities por (age_division_id, gender)
        belts_by_combo: dict[tuple[int, str], list[CompetitionBeltEligibility]] = {}
        for b in belts:
            if b.faixa_id not in faixa_ids_ok:
                continue
            key = (b.age_division_id, b.gender)
            belts_by_combo.setdefault(key, []).append(b)
        if not belts_by_combo:
            raise SystemExit("Nenhuma belt eligibility válida após checar faixas existentes.")

        # Index weight classes por (age_division_id, gender)
        wclasses_by_combo: dict[tuple[int, str], list[CompetitionWeightClass]] = {}
        for wc in wclasses:
            key = (wc.age_division_id, wc.gender)
            wclasses_by_combo.setdefault(key, []).append(wc)
        if not wclasses_by_combo:
            raise SystemExit("Nenhuma weight class indexada por (age_division, gender).")

        # Construção de specs de cobertura:
        specs_set: set[Spec] = set()

        # 1) Garantir todas as weight classes: escolhe uma faixa elegível daquela (age_div, gender)
        for wc in wclasses:
            combo = (wc.age_division_id, wc.gender)
            belt_options = belts_by_combo.get(combo, [])
            if not belt_options:
                continue
            b = rng.choice(belt_options)
            specs_set.add(Spec(age_division_id=wc.age_division_id, gender=wc.gender, weight_class_id=wc.id, faixa_id=b.faixa_id))

        # 2) Garantir todas as faixas (belt eligibility): para cada faixa, escolhe um weight class compatível
        for b in belts:
            combo = (b.age_division_id, b.gender)
            if b.faixa_id not in faixa_ids_ok:
                continue
            wc_options = wclasses_by_combo.get(combo, [])
            if not wc_options:
                continue
            wc = rng.choice(wc_options)
            specs_set.add(Spec(age_division_id=b.age_division_id, gender=b.gender, weight_class_id=wc.id, faixa_id=b.faixa_id))

        specs = list(specs_set)
        if len(specs) > args.count:
            raise SystemExit(
                f"Impossível cumprir exatamente --count com cobertura total. "
                f"Specs mínimas geradas={len(specs)} > --count={args.count}. "
                f"Aumente --count ou relaxe a regra de cobertura."
            )

        # Completa até --count com random (mantendo cobertura básica)
        while len(specs) < args.count:
            # escolhe um spec aleatório a partir de belts/combos
            b = rng.choice(belts)
            if b.faixa_id not in faixa_ids_ok:
                continue
            wc_options = wclasses_by_combo.get((b.age_division_id, b.gender), [])
            if not wc_options:
                continue
            wc = rng.choice(wc_options)
            specs.append(Spec(age_division_id=b.age_division_id, gender=b.gender, weight_class_id=wc.id, faixa_id=b.faixa_id))

        # Busca weight_class por id para limites
        wclass_by_id = {wc.id: wc for wc in wclasses}

        # Decide status e pagamento:
        # - non_weighed_count: status registered
        # - restante: weighed_in
        specs_shuffled = specs[:]
        rng.shuffle(specs_shuffled)

        non_weighed_specs = specs_shuffled[: args.non_weighed_count]
        all_specs_order = specs_shuffled
        non_weighed_cut = args.non_weighed_count
        confirmed_cut = args.confirmed_count

        pending_users: list[User] = []
        pending_students_meta: list[dict[str, object]] = []

        created_regs = 0
        chunk_size = 50

        # Pre-cálculo para evitar N+1: age division ranges
        # (age_by_id já temos)

        async def flush_chunk() -> None:
            nonlocal created_regs
            if not pending_users:
                return

            session.add_all(pending_users)
            await session.flush()  # users -> user.id

            students: list[Student] = []
            for user, meta in zip(pending_users, pending_students_meta):
                student = Student(
                    dojo_id=None,   # atleta externo: sem vínculo de aluno com dojo do sistema
                    name=str(meta["student_name"]),
                    email=str(meta["email"]),
                    phone=None,
                    birth_date=meta["birth_dt"],  # type: ignore[arg-type]
                    user_id=user.id,
                    faixa_id=int(meta["faixa_id"]),
                    grau=0,
                    modalidade=None,
                    notes=None,
                    external_dojo_name=str(meta["external_dojo_name"]),
                    external_faixa_label=None,
                    created_at=now,
                    updated_at=now,
                )
                students.append(student)

            session.add_all(students)
            await session.flush()  # students -> student.id

            regs: list[CompetitionRegistration] = []
            for student, meta in zip(students, pending_students_meta):
                reg = CompetitionRegistration(
                    competition_id=competition_id,
                    student_id=student.id,
                    gender=str(meta["gender"]),
                    age_division_id=int(meta["age_division_id"]),
                    weight_class_id=int(meta["weight_class_id"]),
                    status=str(meta["status"]),
                    declared_weight_kg=meta["declared_weight_kg"],  # type: ignore[arg-type]
                    actual_weight_kg=meta.get("actual_weight_kg"),  # type: ignore[arg-type]
                    registration_public_code=str(meta["registration_public_code"]),
                    ranking_points=float(meta["ranking_points"]),
                    weigh_in_at=meta.get("weigh_in_at"),  # type: ignore[arg-type]
                    weigh_in_notes=None,
                    payment_status=str(meta["payment_status"]),
                    payment_receipt_path=None,
                    payment_notes=None,
                    payment_confirmed_at=now if meta["payment_status"] == PAY_CONFIRMED else None,  # type: ignore[comparison-overlap]
                    created_at=now,
                    updated_at=now,
                )
                regs.append(reg)

            session.add_all(regs)
            created_regs += len(regs)

            pending_users.clear()
            pending_students_meta.clear()

            await session.flush()

        # Criar registros
        # Vamos iterar por índices para definir confirmed/non-weighed.
        for idx, s in enumerate(all_specs_order):
            ad = age_by_id.get(s.age_division_id)
            if ad is None:
                continue

            wc = wclass_by_id.get(s.weight_class_id)
            if wc is None:
                continue

            birth_year = rng.randint(ad.birth_year_min, ad.birth_year_max)
            birth_dt = date(birth_year, 7, 1)

            fn, ln = _pick_name(s.gender, rng)
            student_name = f"{fn} {ln}"
            email = f"seed_{competition_id}_{fn.lower()}_{ln.lower()}_{secrets.token_hex(4)}@seed.local"

            declared_weight = None
            actual_weight = None
            weigh_in_at = None
            status = STATUS_REGISTERED

            if wc.max_weight_kg is not None:
                # declarado sempre abaixo do máximo
                declared_weight = round(wc.max_weight_kg * rng.uniform(0.65, 0.95), 2)
                if idx < non_weighed_cut:
                    status = STATUS_REGISTERED
                    actual_weight = None
                else:
                    status = STATUS_WEIGHED_IN
                    # actual dentro do limite para evitar reclassificação/pergunta
                    actual_weight = round(wc.max_weight_kg * rng.uniform(0.65, 0.99), 2)
                    weigh_in_at = now
            else:
                declared_weight = round(rng.uniform(50, 110), 2)
                if idx < non_weighed_cut:
                    status = STATUS_REGISTERED
                    actual_weight = None
                else:
                    status = STATUS_WEIGHED_IN
                    actual_weight = round(rng.uniform(50, 110), 2)
                    weigh_in_at = now

            # payment status: primeiros confirmed_cut como confirmed, demais not_applicable
            payment_status = PAY_CONFIRMED if idx < confirmed_cut else "not_applicable"

            # Atletas externos: usamos o nome do dojo como texto (external_dojo_name),
            # sem FK para o dojo — assim não aparecem na aba Alunos de nenhum dojo do sistema.
            selected_dojo_name = rng.choice(dojos).name

            pending_users.append(
                User(
                    email=email.lower(),
                    password_hash=password_hash,
                    role="aluno",
                    dojo_id=None,   # participante externo, não é membro de nenhum dojo cadastrado
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                    name=student_name,
                )
            )
            pending_students_meta.append(
                {
                    "student_name": student_name,
                    "email": email.lower(),
                    "birth_dt": birth_dt,
                    "faixa_id": s.faixa_id,
                    "dojo_id": None,                      # sem vínculo de aluno com dojo do sistema
                    "external_dojo_name": selected_dojo_name,  # academia do atleta, em texto
                    "gender": s.gender,
                    "age_division_id": s.age_division_id,
                    "weight_class_id": s.weight_class_id,
                    "status": status,
                    "declared_weight_kg": declared_weight,
                    "actual_weight_kg": actual_weight,
                    "weigh_in_at": weigh_in_at,
                    "registration_public_code": _reg_code(),
                    "ranking_points": 0.0,
                    "payment_status": payment_status,
                }
            )

            if len(pending_users) >= chunk_size:
                await flush_chunk()
                # commit só ao final do seed completo

        await flush_chunk()
        await session.commit()

        print(f"[seed-full] Criados {created_regs} inscrições na competition_id={competition_id}.")


if __name__ == "__main__":
    asyncio.run(main())

