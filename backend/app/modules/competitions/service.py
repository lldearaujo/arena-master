from __future__ import annotations

import json
from collections import defaultdict
import math
import secrets
from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.competition import (
    Competition,
    CompetitionAgeDivision,
    CompetitionBeltEligibility,
    CompetitionBracket,
    CompetitionMat,
    CompetitionMatch,
    CompetitionRegistration,
    CompetitionWeightClass,
    NotificationOutbox,
)
from app.models.dojo import Dojo
from app.models.faixa import Faixa
from app.models.student import Student
from app.models.user import User
from app.core.security import create_access_token, create_refresh_token, get_password_hash
from app.modules.competitions import schemas
from app.modules.competitions.federation_presets import get_preset
from app.modules.competitions.federation_presets.belt_resolve import (
    collect_unique_canonicals,
    resolve_faixa_id_for_canonical,
)
from app.modules.competitions.bracket_logic import (
    bracket_seed_positions,
    next_power_of_2,
    try_reduce_same_dojo_pairings,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


REG_PAY_NOT_APPLICABLE = "not_applicable"
REG_PAY_PENDING_PAYMENT = "pending_payment"
REG_PAY_PENDING_CONFIRMATION = "pending_confirmation"
REG_PAY_CONFIRMED = "confirmed"
REG_PAY_REJECTED = "rejected"


def _fee_requires_payment(comp: Competition) -> bool:
    return comp.registration_fee_amount is not None and comp.registration_fee_amount > 0


def _initial_registration_payment_status(comp: Competition) -> str:
    return REG_PAY_PENDING_PAYMENT if _fee_requires_payment(comp) else REG_PAY_NOT_APPLICABLE


def _registration_payment_cleared(reg: CompetitionRegistration) -> bool:
    return reg.payment_status in (REG_PAY_NOT_APPLICABLE, REG_PAY_CONFIRMED)


async def _get_competition(session: AsyncSession, competition_id: int) -> Competition | None:
    r = await session.execute(select(Competition).where(Competition.id == competition_id))
    return r.scalar_one_or_none()


def _assert_organizer(comp: Competition, user: User) -> None:
    if user.role == "superadmin":
        return
    if user.role != "admin" or user.dojo_id != comp.organizer_dojo_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão nesta competição")


async def list_competitions(session: AsyncSession, user: User) -> list[Competition]:
    if user.role == "superadmin":
        r = await session.execute(select(Competition).order_by(Competition.created_at.desc()))
        return list(r.scalars().all())
    if user.role == "admin" and user.dojo_id is not None:
        r = await session.execute(
            select(Competition)
            .where(Competition.organizer_dojo_id == user.dojo_id)
            .order_by(Competition.created_at.desc())
        )
        return list(r.scalars().all())
    if user.role == "aluno":
        r = await session.execute(
            select(Competition)
            .where(Competition.is_published.is_(True))
            .order_by(Competition.reference_year.desc(), Competition.created_at.desc())
        )
        return list(r.scalars().all())
    return []


async def list_organizer_kpis(session: AsyncSession, user: User) -> list[schemas.CompetitionKpiItem]:
    if user.role not in ("superadmin", "admin") or (user.role == "admin" and user.dojo_id is None):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")
    competitions = await list_competitions(session, user)
    if not competitions:
        return []
    ids = [c.id for c in competitions]

    r_tot = await session.execute(
        select(CompetitionRegistration.competition_id, func.count())
        .where(CompetitionRegistration.competition_id.in_(ids))
        .group_by(CompetitionRegistration.competition_id)
    )
    totals = {row[0]: int(row[1]) for row in r_tot.all()}

    r_st = await session.execute(
        select(
            CompetitionRegistration.competition_id,
            CompetitionRegistration.status,
            func.count(),
        )
        .where(CompetitionRegistration.competition_id.in_(ids))
        .group_by(CompetitionRegistration.competition_id, CompetitionRegistration.status)
    )
    by_status: dict[int, dict[str, int]] = defaultdict(dict)
    for cid, st, cnt in r_st.all():
        by_status[int(cid)][str(st)] = int(cnt)

    r_br = await session.execute(
        select(CompetitionBracket.competition_id, func.count())
        .where(CompetitionBracket.competition_id.in_(ids))
        .group_by(CompetitionBracket.competition_id)
    )
    brackets = {row[0]: int(row[1]) for row in r_br.all()}

    r_pend = await session.execute(
        select(CompetitionRegistration.competition_id, func.count())
        .where(
            CompetitionRegistration.competition_id.in_(ids),
            CompetitionRegistration.payment_status == REG_PAY_PENDING_CONFIRMATION,
        )
        .group_by(CompetitionRegistration.competition_id)
    )
    pending_pay = {row[0]: int(row[1]) for row in r_pend.all()}

    out: list[schemas.CompetitionKpiItem] = []
    for c in competitions:
        stmap = by_status.get(c.id, {})
        out.append(
            schemas.CompetitionKpiItem(
                competition_id=c.id,
                name=c.name,
                reference_year=c.reference_year,
                is_published=c.is_published,
                organizer_dojo_id=c.organizer_dojo_id,
                registrations_total=totals.get(c.id, 0),
                registrations_registered=int(stmap.get("registered", 0)),
                registrations_weighed_in=int(stmap.get("weighed_in", 0)),
                registrations_disqualified=int(stmap.get("disqualified", 0)),
                brackets_count=brackets.get(c.id, 0),
                pending_registration_payment_confirmations=pending_pay.get(c.id, 0),
            )
        )
    return out


async def create_competition(session: AsyncSession, user: User, payload: schemas.CompetitionCreate) -> Competition:
    if user.role != "admin" or user.dojo_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas admin do dojo cria competições")
    comp = Competition(
        organizer_dojo_id=user.dojo_id,
        name=payload.name,
        reference_year=payload.reference_year,
        event_starts_at=payload.event_starts_at,
        default_match_duration_seconds=payload.default_match_duration_seconds,
        transition_buffer_seconds=payload.transition_buffer_seconds,
        is_published=payload.is_published,
        registration_fee_amount=payload.registration_fee_amount,
        registration_payment_instructions=payload.registration_payment_instructions,
    )
    session.add(comp)
    await session.commit()
    await session.refresh(comp)
    return comp


async def update_competition(
    session: AsyncSession, user: User, competition_id: int, payload: schemas.CompetitionUpdate
) -> Competition:
    comp = await _get_competition(session, competition_id)
    if comp is None:
        raise HTTPException(status_code=404, detail="Competição não encontrada")
    _assert_organizer(comp, user)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(comp, k, v)
    comp.updated_at = _now()
    await session.commit()
    await session.refresh(comp)
    return comp


async def get_competition(session: AsyncSession, user: User, competition_id: int) -> Competition:
    comp = await _get_competition(session, competition_id)
    if comp is None:
        raise HTTPException(status_code=404, detail="Competição não encontrada")
    if user.role == "superadmin":
        return comp
    if user.role == "aluno":
        if not comp.is_published:
            raise HTTPException(status_code=404, detail="Competição não encontrada")
        return comp
    if user.role == "admin" and user.dojo_id == comp.organizer_dojo_id:
        return comp
    raise HTTPException(status_code=403, detail="Sem permissão nesta competição")


async def competition_read_with_organizer(
    session: AsyncSession,
    comp: Competition,
) -> schemas.CompetitionRead:
    from app.models.dojo import Dojo

    r = await session.execute(select(Dojo).where(Dojo.id == comp.organizer_dojo_id))
    dojo = r.scalar_one_or_none()
    base = schemas.CompetitionRead.model_validate(comp)
    if dojo is None:
        return base
    return base.model_copy(
        update={
            "organizer_dojo_name": dojo.name,
            "organizer_logo_url": dojo.logo_url,
        }
    )


# --- age divisions ---


async def create_age_division(
    session: AsyncSession, user: User, competition_id: int, payload: schemas.AgeDivisionCreate
) -> CompetitionAgeDivision:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    row = CompetitionAgeDivision(
        competition_id=comp.id,
        label=payload.label,
        birth_year_min=payload.birth_year_min,
        birth_year_max=payload.birth_year_max,
        sort_order=payload.sort_order,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def list_age_divisions(session: AsyncSession, user: User, competition_id: int) -> list[CompetitionAgeDivision]:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    r = await session.execute(
        select(CompetitionAgeDivision)
        .where(CompetitionAgeDivision.competition_id == competition_id)
        .order_by(CompetitionAgeDivision.sort_order, CompetitionAgeDivision.id)
    )
    return list(r.scalars().all())


# --- weight classes ---


def _fmt_kg_display(n: float) -> str:
    if abs(n - round(n)) < 1e-9:
        return str(int(round(n)))
    s = f"{n:.2f}".rstrip("0").rstrip(".")
    return s.replace(".", ",")


def _weight_interval_label(prev_max_kg: float | None, max_kg: float | None) -> str:
    """Intervalo implícito entre categorias consecutivas (mesma idade, género e modalidade)."""
    if max_kg is None:
        if prev_max_kg is None:
            return "Sem teto (absoluto)"
        return f"{_fmt_kg_display(prev_max_kg)} kg ou mais"
    if prev_max_kg is None:
        return f"até {_fmt_kg_display(max_kg)} kg"
    return f"{_fmt_kg_display(prev_max_kg)}–{_fmt_kg_display(max_kg)} kg"


def weight_interval_labels_by_id(classes: list[CompetitionWeightClass]) -> dict[int, str]:
    groups: dict[tuple[int, str, str], list[CompetitionWeightClass]] = defaultdict(list)
    for w in classes:
        mod = getattr(w, "modality", None) or "gi"
        groups[(w.age_division_id, w.gender, mod)].append(w)
    out: dict[int, str] = {}
    for rows in groups.values():
        rows.sort(key=lambda x: (x.sort_order, x.id))
        prev: float | None = None
        for wc in rows:
            out[wc.id] = _weight_interval_label(prev, wc.max_weight_kg)
            if wc.max_weight_kg is not None:
                prev = wc.max_weight_kg
    return out


def weight_classes_to_read(classes: list[CompetitionWeightClass]) -> list[schemas.WeightClassRead]:
    intervals = weight_interval_labels_by_id(classes)
    result: list[schemas.WeightClassRead] = []
    for w in classes:
        base = schemas.WeightClassRead.model_validate(w)
        result.append(base.model_copy(update={"weight_interval_label": intervals.get(w.id)}))
    return result


async def create_weight_class(
    session: AsyncSession, user: User, competition_id: int, payload: schemas.WeightClassCreate
) -> CompetitionWeightClass:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    ad = await session.get(CompetitionAgeDivision, payload.age_division_id)
    if ad is None or ad.competition_id != comp.id:
        raise HTTPException(status_code=400, detail="Divisão de idade inválida")
    row = CompetitionWeightClass(
        competition_id=comp.id,
        age_division_id=payload.age_division_id,
        gender=payload.gender,
        modality=payload.modality,
        label=payload.label,
        max_weight_kg=payload.max_weight_kg,
        sort_order=payload.sort_order,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def list_weight_classes(session: AsyncSession, user: User, competition_id: int) -> list[CompetitionWeightClass]:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    r = await session.execute(
        select(CompetitionWeightClass)
        .where(CompetitionWeightClass.competition_id == competition_id)
        .order_by(CompetitionWeightClass.modality, CompetitionWeightClass.sort_order, CompetitionWeightClass.id)
    )
    return list(r.scalars().all())


# --- belt eligibility ---


async def add_belt_eligibility(
    session: AsyncSession, user: User, competition_id: int, payload: schemas.BeltEligibilityCreate
) -> CompetitionBeltEligibility:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    ad = await session.get(CompetitionAgeDivision, payload.age_division_id)
    if ad is None or ad.competition_id != comp.id:
        raise HTTPException(status_code=400, detail="Divisão inválida")
    row = CompetitionBeltEligibility(
        competition_id=comp.id,
        age_division_id=payload.age_division_id,
        gender=payload.gender,
        faixa_id=payload.faixa_id,
    )
    session.add(row)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Combinação já existe ou faixa inválida")
    await session.refresh(row)
    return row


async def list_belt_eligibility(
    session: AsyncSession, user: User, competition_id: int
) -> list[CompetitionBeltEligibility]:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    r = await session.execute(
        select(CompetitionBeltEligibility).where(
            CompetitionBeltEligibility.competition_id == competition_id
        )
    )
    return list(r.scalars().all())


async def apply_federation_preset(
    session: AsyncSession,
    user: User,
    competition_id: int,
    preset_code: str,
) -> schemas.ApplyFederationPresetResponse:
    preset = get_preset(preset_code)
    if preset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset não encontrado")
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)

    # Memoriza quais regras/preset foram aplicados na competição
    # (usado pela UI para habilitar opções de placar/finalização).
    comp.federation_preset_code = preset.code

    n_regs = await session.scalar(
        select(func.count())
        .select_from(CompetitionRegistration)
        .where(CompetitionRegistration.competition_id == competition_id)
    )
    if n_regs and n_regs > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível substituir categorias: existem inscrições nesta competição.",
        )

    r_fx = await session.execute(
        select(Faixa)
        .where(Faixa.dojo_id == comp.organizer_dojo_id)
        .order_by(Faixa.ordem, Faixa.id)
    )
    faixas = list(r_fx.scalars().all())
    needed = collect_unique_canonicals(preset.belt_triples)
    resolved: dict[str, int] = {}
    for canon in needed:
        fid = resolve_faixa_id_for_canonical(faixas, canon)
        if fid is not None:
            resolved[canon] = fid

    await session.execute(
        delete(CompetitionAgeDivision).where(CompetitionAgeDivision.competition_id == competition_id)
    )
    await session.flush()

    ref = comp.reference_year
    div_id_by_key: dict[str, int] = {}
    for spec in preset.age_divisions:
        birth_year_min = ref - spec.age_max
        birth_year_max = ref - spec.age_min
        row = CompetitionAgeDivision(
            competition_id=comp.id,
            label=spec.label,
            birth_year_min=birth_year_min,
            birth_year_max=birth_year_max,
            sort_order=spec.sort_order,
        )
        session.add(row)
        await session.flush()
        div_id_by_key[spec.key] = row.id

    n_w = 0
    for w in preset.weights:
        aid = div_id_by_key[w.division_key]
        session.add(
            CompetitionWeightClass(
                competition_id=comp.id,
                age_division_id=aid,
                gender=w.gender,
                modality=w.modality,
                label=w.label,
                max_weight_kg=w.max_kg,
                sort_order=w.sort_order,
            )
        )
        n_w += 1

    n_b = 0
    skipped_belt_keys: list[str] = []
    for div_key, gender, belt in preset.belt_triples:
        faixa_id = resolved.get(belt)
        if faixa_id is None:
            skipped_belt_keys.append(belt)
            continue
        aid = div_id_by_key[div_key]
        session.add(
            CompetitionBeltEligibility(
                competition_id=comp.id,
                age_division_id=aid,
                gender=gender,
                faixa_id=faixa_id,
            )
        )
        n_b += 1

    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise

    return schemas.ApplyFederationPresetResponse(
        preset_code=preset.code,
        reference_year_used=ref,
        age_divisions_created=len(preset.age_divisions),
        weight_classes_created=n_w,
        belt_eligibility_created=n_b,
        skipped_belt_keys=sorted(set(skipped_belt_keys)),
    )


# --- eligibility cascade ---


async def get_eligibility_options(
    session: AsyncSession,
    user: User,
    competition_id: int,
    gender: str | None,
    birth_year: int | None,
    modality: str | None = None,
) -> schemas.EligibilityOptionsResponse:
    comp = await get_competition(session, user, competition_id)
    if user.role == "aluno" and not comp.is_published:
        raise HTTPException(status_code=404, detail="Competição não encontrada")

    r_ad = await session.execute(
        select(CompetitionAgeDivision)
        .where(CompetitionAgeDivision.competition_id == competition_id)
        .order_by(CompetitionAgeDivision.sort_order)
    )
    divisions = list(r_ad.scalars().all())

    r_be = await session.execute(
        select(CompetitionBeltEligibility).where(
            CompetitionBeltEligibility.competition_id == competition_id
        )
    )
    belts = list(r_be.scalars().all())

    age_opts: list[schemas.EligibilityAgeOption] = []
    for d in divisions:
        if birth_year is not None and not (d.birth_year_min <= birth_year <= d.birth_year_max):
            continue
        allowed: set[int] = set()
        for b in belts:
            if b.age_division_id != d.id:
                continue
            if gender and b.gender != gender:
                continue
            allowed.add(b.faixa_id)
        age_opts.append(
            schemas.EligibilityAgeOption(
                age_division=schemas.AgeDivisionRead.model_validate(d),
                allowed_faixa_ids=sorted(allowed),
            )
        )

    wc_query = select(CompetitionWeightClass).where(
        CompetitionWeightClass.competition_id == competition_id
    )
    if gender:
        wc_query = wc_query.where(CompetitionWeightClass.gender == gender)
    if modality in ("gi", "nogi"):
        wc_query = wc_query.where(CompetitionWeightClass.modality == modality)
    r_wc = await session.execute(
        wc_query.order_by(CompetitionWeightClass.modality, CompetitionWeightClass.sort_order)
    )
    wclasses = list(r_wc.scalars().all())

    intervals = weight_interval_labels_by_id(wclasses)
    weight_opts: list[schemas.EligibilityWeightOption] = []
    for w in wclasses:
        if birth_year is not None:
            ad = await session.get(CompetitionAgeDivision, w.age_division_id)
            if ad is None or not (ad.birth_year_min <= birth_year <= ad.birth_year_max):
                continue
        wc_read = schemas.WeightClassRead.model_validate(w).model_copy(
            update={"weight_interval_label": intervals.get(w.id)}
        )
        weight_opts.append(schemas.EligibilityWeightOption(weight_class=wc_read))

    return schemas.EligibilityOptionsResponse(age_divisions=age_opts, weight_classes=weight_opts)


async def get_public_competition_summary(
    session: AsyncSession, competition_id: int
) -> schemas.CompetitionRead:
    comp = await _get_competition(session, competition_id)
    if comp is None or not comp.is_published:
        raise HTTPException(status_code=404, detail="Competição não encontrada")
    return await competition_read_with_organizer(session, comp)


async def get_public_eligibility_options(
    session: AsyncSession,
    competition_id: int,
    gender: str | None,
    birth_year: int | None,
    modality: str | None = None,
) -> schemas.EligibilityOptionsResponse:
    comp = await _get_competition(session, competition_id)
    if comp is None or not comp.is_published:
        raise HTTPException(status_code=404, detail="Competição não encontrada")

    r_ad = await session.execute(
        select(CompetitionAgeDivision)
        .where(CompetitionAgeDivision.competition_id == competition_id)
        .order_by(CompetitionAgeDivision.sort_order)
    )
    divisions = list(r_ad.scalars().all())

    age_opts: list[schemas.EligibilityAgeOption] = []
    for d in divisions:
        if birth_year is not None and not (d.birth_year_min <= birth_year <= d.birth_year_max):
            continue
        age_opts.append(
            schemas.EligibilityAgeOption(
                age_division=schemas.AgeDivisionRead.model_validate(d),
                allowed_faixa_ids=[],
            )
        )

    wc_query = select(CompetitionWeightClass).where(
        CompetitionWeightClass.competition_id == competition_id
    )
    if gender:
        wc_query = wc_query.where(CompetitionWeightClass.gender == gender)
    if modality in ("gi", "nogi"):
        wc_query = wc_query.where(CompetitionWeightClass.modality == modality)
    r_wc = await session.execute(
        wc_query.order_by(CompetitionWeightClass.modality, CompetitionWeightClass.sort_order)
    )
    wclasses = list(r_wc.scalars().all())

    intervals = weight_interval_labels_by_id(wclasses)
    weight_opts: list[schemas.EligibilityWeightOption] = []
    for w in wclasses:
        if birth_year is not None:
            ad = await session.get(CompetitionAgeDivision, w.age_division_id)
            if ad is None or not (ad.birth_year_min <= birth_year <= ad.birth_year_max):
                continue
        wc_read = schemas.WeightClassRead.model_validate(w).model_copy(
            update={"weight_interval_label": intervals.get(w.id)}
        )
        weight_opts.append(schemas.EligibilityWeightOption(weight_class=wc_read))

    # Faixas distintas habilitadas no evento (para o select do formulário público)
    r_belt_ids = await session.execute(
        select(CompetitionBeltEligibility.faixa_id)
        .where(CompetitionBeltEligibility.competition_id == competition_id)
        .distinct()
    )
    faixa_ids = [row[0] for row in r_belt_ids.all()]
    faixa_opts: list[schemas.FaixaOption] = []
    if faixa_ids:
        r_faixas = await session.execute(
            select(Faixa).where(Faixa.id.in_(faixa_ids)).order_by(Faixa.ordem)
        )
        faixa_opts = [
            schemas.FaixaOption(id=f.id, label=f.name) for f in r_faixas.scalars().all()
        ]

    return schemas.EligibilityOptionsResponse(
        age_divisions=age_opts,
        weight_classes=weight_opts,
        allowed_faixas=faixa_opts,
    )


async def _validate_registration_eligibility(
    session: AsyncSession,
    comp: Competition,
    student: Student,
    gender: str,
    age_division_id: int,
    weight_class_id: int,
    *,
    skip_belt_check: bool = False,
    declared_weight_kg: float | None = None,
) -> None:
    if student.birth_date is None:
        raise HTTPException(status_code=400, detail="Aluno sem data de nascimento")
    by = student.birth_date.year
    ad = await session.get(CompetitionAgeDivision, age_division_id)
    if ad is None or ad.competition_id != comp.id:
        raise HTTPException(status_code=400, detail="Divisão de idade inválida")
    if not (ad.birth_year_min <= by <= ad.birth_year_max):
        raise HTTPException(status_code=400, detail="Ano de nascimento fora da divisão")

    wc = await session.get(CompetitionWeightClass, weight_class_id)
    if wc is None or wc.competition_id != comp.id:
        raise HTTPException(status_code=400, detail="Categoria de peso inválida")
    if wc.age_division_id != ad.id or wc.gender != gender:
        raise HTTPException(status_code=400, detail="Peso não combina com idade/gênero")

    if (
        declared_weight_kg is not None
        and wc.max_weight_kg is not None
        and declared_weight_kg > wc.max_weight_kg + 1e-6
    ):
        raise HTTPException(
            status_code=400,
            detail="Peso declarado acima do limite desta categoria",
        )

    if skip_belt_check:
        return

    if student.faixa_id is None:
        raise HTTPException(status_code=400, detail="Aluno sem faixa cadastrada")
    r = await session.execute(
        select(CompetitionBeltEligibility).where(
            CompetitionBeltEligibility.competition_id == comp.id,
            CompetitionBeltEligibility.age_division_id == ad.id,
            CompetitionBeltEligibility.gender == gender,
            CompetitionBeltEligibility.faixa_id == student.faixa_id,
        )
    )
    if r.scalar_one_or_none() is None:
        raise HTTPException(status_code=400, detail="Faixa do aluno não permitida nesta divisão/gênero")


# --- registrations ---


def _reg_code() -> str:
    return secrets.token_hex(4)


async def create_registration(
    session: AsyncSession, user: User, competition_id: int, payload: schemas.RegistrationCreate
) -> CompetitionRegistration:
    comp = await _get_competition(session, competition_id)
    if comp is None:
        raise HTTPException(status_code=404, detail="Competição não encontrada")
    if user.role == "aluno":
        if not comp.is_published:
            raise HTTPException(status_code=404, detail="Competição não encontrada")
    else:
        _assert_organizer(comp, user)

    student = await session.get(Student, payload.student_id)
    if student is None:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    if user.role == "aluno":
        if student.user_id != user.id:
            raise HTTPException(status_code=403, detail="Inscrição só para o próprio perfil")
    elif user.role == "admin":
        if comp.organizer_dojo_id != user.dojo_id:
            raise HTTPException(status_code=403, detail="Sem permissão")

    await _validate_registration_eligibility(
        session, comp, student, payload.gender, payload.age_division_id, payload.weight_class_id
    )

    existing = await session.execute(
        select(CompetitionRegistration).where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.student_id == payload.student_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Aluno já inscrito")

    pay_st = _initial_registration_payment_status(comp)
    reg = CompetitionRegistration(
        competition_id=competition_id,
        student_id=payload.student_id,
        gender=payload.gender,
        age_division_id=payload.age_division_id,
        weight_class_id=payload.weight_class_id,
        status="registered",
        registration_public_code=_reg_code(),
        payment_status=pay_st,
    )
    session.add(reg)
    await session.commit()
    await session.refresh(reg)
    return reg


async def list_registrations(
    session: AsyncSession, user: User, competition_id: int
) -> list[CompetitionRegistration]:
    comp = await get_competition(session, user, competition_id)
    if user.role == "aluno":
        r = await session.execute(
            select(CompetitionRegistration)
            .where(CompetitionRegistration.competition_id == competition_id)
            .join(Student, Student.id == CompetitionRegistration.student_id)
            .where(Student.user_id == user.id)
        )
        return list(r.scalars().all())
    _assert_organizer(comp, user)
    r = await session.execute(
        select(CompetitionRegistration).where(CompetitionRegistration.competition_id == competition_id)
    )
    return list(r.scalars().all())


async def registration_to_read(session: AsyncSession, reg: CompetitionRegistration) -> schemas.RegistrationRead:
    st = await session.get(Student, reg.student_id)
    faixa = None
    if st and st.faixa_id is not None:
        faixa = await session.get(Faixa, st.faixa_id)
    dojo = None
    if st and st.dojo_id is not None:
        dojo = await session.get(Dojo, st.dojo_id)
    comp = await session.get(Competition, reg.competition_id)
    ad = await session.get(CompetitionAgeDivision, reg.age_division_id)
    wc = await session.get(CompetitionWeightClass, reg.weight_class_id)
    wc_lbl = f"[{wc.modality}] {wc.label}" if wc else None
    return schemas.RegistrationRead(
        id=reg.id,
        competition_id=reg.competition_id,
        student_id=reg.student_id,
        gender=reg.gender,
        age_division_id=reg.age_division_id,
        weight_class_id=reg.weight_class_id,
        status=reg.status,
        declared_weight_kg=reg.declared_weight_kg,
        actual_weight_kg=reg.actual_weight_kg,
        registration_public_code=reg.registration_public_code,
        ranking_points=reg.ranking_points,
        weigh_in_at=reg.weigh_in_at,
        student_name=st.name if st else None,
        student_dojo_id=st.dojo_id if st else None,
        student_dojo_name=dojo.name if dojo else None,
        student_external_dojo_name=st.external_dojo_name if st else None,
        student_faixa_id=st.faixa_id if st else None,
        student_faixa_label=faixa.name if faixa else None,
        student_external_faixa_label=st.external_faixa_label if st else None,
        payment_status=reg.payment_status,
        payment_receipt_path=reg.payment_receipt_path,
        payment_notes=reg.payment_notes,
        payment_confirmed_at=reg.payment_confirmed_at,
        competition_name=comp.name if comp else None,
        registration_fee_amount=comp.registration_fee_amount if comp else None,
        registration_payment_instructions=comp.registration_payment_instructions if comp else None,
        age_division_label=ad.label if ad else None,
        weight_class_label=wc_lbl,
    )


async def registrations_to_read_many(
    session: AsyncSession, regs: list[CompetitionRegistration]
) -> list[schemas.RegistrationRead]:
    """Evita o padrão N+1 queries ao listar inscrições.

    `registration_to_read()` usa várias chamadas `session.get()` por inscrição; com centenas de registros
    isso pode sobrecarregar o banco e causar respostas inconsistentes/timeout.
    """

    if not regs:
        return []

    comp_id = regs[0].competition_id
    comp = await session.get(Competition, comp_id)

    student_ids = {r.student_id for r in regs}
    age_ids = {r.age_division_id for r in regs}
    weight_ids = {r.weight_class_id for r in regs}

    r_students = await session.execute(select(Student).where(Student.id.in_(student_ids)))
    students = {s.id: s for s in r_students.scalars().all()}

    faixa_ids = {s.faixa_id for s in students.values() if s.faixa_id is not None}
    r_faixas = (
        await session.execute(select(Faixa).where(Faixa.id.in_(faixa_ids))) if faixa_ids else None
    )
    faixas = {f.id: f for f in (r_faixas.scalars().all() if r_faixas else [])}

    dojo_ids = {s.dojo_id for s in students.values() if s.dojo_id is not None}
    r_dojos = (
        await session.execute(select(Dojo).where(Dojo.id.in_(dojo_ids))) if dojo_ids else None
    )
    dojos = {d.id: d for d in (r_dojos.scalars().all() if r_dojos else [])}

    r_age = await session.execute(
        select(CompetitionAgeDivision).where(CompetitionAgeDivision.id.in_(age_ids))
    )
    age_map = {a.id: a for a in r_age.scalars().all()}

    r_wc = await session.execute(
        select(CompetitionWeightClass).where(CompetitionWeightClass.id.in_(weight_ids))
    )
    wc_map = {w.id: w for w in r_wc.scalars().all()}

    out: list[schemas.RegistrationRead] = []
    for reg in regs:
        st = students.get(reg.student_id)
        faixa_name = None
        if st and st.faixa_id is not None:
            faixa = faixas.get(st.faixa_id)
            faixa_name = faixa.name if faixa else None

        dojo_name = None
        if st and st.dojo_id is not None:
            d = dojos.get(st.dojo_id)
            dojo_name = d.name if d else None

        wc = wc_map.get(reg.weight_class_id)
        wc_lbl = f"[{wc.modality}] {wc.label}" if wc else None

        ad = age_map.get(reg.age_division_id)

        out.append(
            schemas.RegistrationRead(
                id=reg.id,
                competition_id=reg.competition_id,
                student_id=reg.student_id,
                gender=reg.gender,
                age_division_id=reg.age_division_id,
                weight_class_id=reg.weight_class_id,
                status=reg.status,
                declared_weight_kg=reg.declared_weight_kg,
                actual_weight_kg=reg.actual_weight_kg,
                registration_public_code=reg.registration_public_code,
                ranking_points=reg.ranking_points,
                weigh_in_at=reg.weigh_in_at,
                student_name=st.name if st else None,
                student_dojo_id=st.dojo_id if st else None,
                student_dojo_name=dojo_name,
                student_external_dojo_name=st.external_dojo_name if st else None,
                student_faixa_id=st.faixa_id if st else None,
                student_faixa_label=faixa_name,
                student_external_faixa_label=st.external_faixa_label if st else None,
                payment_status=reg.payment_status,
                payment_receipt_path=reg.payment_receipt_path,
                payment_notes=reg.payment_notes,
                payment_confirmed_at=reg.payment_confirmed_at,
                competition_name=comp.name if comp else None,
                registration_fee_amount=comp.registration_fee_amount if comp else None,
                registration_payment_instructions=comp.registration_payment_instructions if comp else None,
                age_division_label=ad.label if ad else None,
                weight_class_label=wc_lbl,
            )
        )
    return out


async def register_public_competition(
    session: AsyncSession,
    competition_id: int,
    payload: schemas.PublicCompetitionRegistrationCreate,
) -> tuple[CompetitionRegistration, User]:
    comp = await _get_competition(session, competition_id)
    if comp is None or not comp.is_published:
        raise HTTPException(status_code=404, detail="Competição não encontrada")

    existing_u = await session.execute(select(User).where(User.email == payload.email))
    if existing_u.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    now = _now()
    user = User(
        email=str(payload.email).strip().lower(),
        password_hash=get_password_hash(payload.password),
        role="aluno",
        dojo_id=None,
        name=payload.name.strip(),
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    session.add(user)
    await session.flush()

    bd = date(payload.birth_year, 7, 1)
    student = Student(
        dojo_id=None,
        name=payload.name.strip(),
        email=str(payload.email).strip().lower(),
        birth_date=bd,
        user_id=user.id,
        faixa_id=None,
        grau=0,
        external_dojo_name=payload.external_dojo_name.strip(),
        external_faixa_label=payload.external_faixa_label.strip(),
        created_at=now,
        updated_at=now,
    )
    session.add(student)
    await session.flush()

    await _validate_registration_eligibility(
        session,
        comp,
        student,
        payload.gender,
        payload.age_division_id,
        payload.weight_class_id,
        skip_belt_check=True,
        declared_weight_kg=payload.declared_weight_kg,
    )

    dup = await session.execute(
        select(CompetitionRegistration).where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.student_id == student.id,
        )
    )
    if dup.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Aluno já inscrito")

    pay_st = _initial_registration_payment_status(comp)
    reg = CompetitionRegistration(
        competition_id=competition_id,
        student_id=student.id,
        gender=payload.gender,
        age_division_id=payload.age_division_id,
        weight_class_id=payload.weight_class_id,
        status="registered",
        registration_public_code=_reg_code(),
        declared_weight_kg=payload.declared_weight_kg,
        payment_status=pay_st,
    )
    session.add(reg)
    await session.commit()
    await session.refresh(reg)
    await session.refresh(user)
    return reg, user


async def list_my_registration_summaries(
    session: AsyncSession, user: User
) -> list[schemas.RegistrationRead]:
    if user.role != "aluno":
        raise HTTPException(status_code=403, detail="Somente alunos")
    r = await session.execute(select(Student).where(Student.user_id == user.id))
    students = list(r.scalars().all())
    if not students:
        return []
    st_ids = [s.id for s in students]
    r2 = await session.execute(
        select(CompetitionRegistration)
        .where(CompetitionRegistration.student_id.in_(st_ids))
        .order_by(CompetitionRegistration.id.desc())
    )
    rows = list(r2.scalars().all())
    return [await registration_to_read(session, x) for x in rows]


async def attach_competition_banner(
    session: AsyncSession,
    user: User,
    competition_id: int,
    public_path: str,
) -> Competition:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    comp.banner_url = public_path
    comp.updated_at = _now()
    await session.commit()
    await session.refresh(comp)
    return comp


async def attach_registration_payment_receipt(
    session: AsyncSession,
    user: User,
    competition_id: int,
    registration_id: int,
    public_path: str,
) -> CompetitionRegistration:
    await get_competition(session, user, competition_id)
    reg = await session.get(CompetitionRegistration, registration_id)
    if reg is None or reg.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    st = await session.get(Student, reg.student_id)
    if st is None or st.user_id != user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    if reg.payment_status not in (REG_PAY_PENDING_PAYMENT, REG_PAY_REJECTED):
        raise HTTPException(
            status_code=400,
            detail="Não é possível enviar comprovante neste estado da inscrição",
        )
    reg.payment_receipt_path = public_path
    reg.payment_status = REG_PAY_PENDING_CONFIRMATION
    reg.updated_at = _now()
    await session.commit()
    await session.refresh(reg)
    return reg


async def confirm_registration_payment(
    session: AsyncSession, user: User, competition_id: int, registration_id: int
) -> CompetitionRegistration:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    reg = await session.get(CompetitionRegistration, registration_id)
    if reg is None or reg.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    if reg.payment_status != REG_PAY_PENDING_CONFIRMATION:
        raise HTTPException(
            status_code=400, detail="Inscrição sem comprovante pendente de confirmação"
        )
    reg.payment_status = REG_PAY_CONFIRMED
    reg.payment_confirmed_at = _now()
    reg.updated_at = _now()
    await session.commit()
    await session.refresh(reg)
    return reg


async def reject_registration_payment(
    session: AsyncSession,
    user: User,
    competition_id: int,
    registration_id: int,
    payload: schemas.RegistrationPaymentRejectBody | None,
) -> CompetitionRegistration:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    reg = await session.get(CompetitionRegistration, registration_id)
    if reg is None or reg.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    if reg.payment_status != REG_PAY_PENDING_CONFIRMATION:
        raise HTTPException(status_code=400, detail="Nenhum comprovante aguardando análise")
    reg.payment_status = REG_PAY_REJECTED
    reg.payment_notes = payload.notes if payload and payload.notes else reg.payment_notes
    reg.updated_at = _now()
    await session.commit()
    await session.refresh(reg)
    return reg


async def list_organizer_pending_registration_payments(
    session: AsyncSession, user: User
) -> list[schemas.RegistrationRead]:
    if user.role not in ("superadmin", "admin"):
        raise HTTPException(status_code=403, detail="Sem permissão")
    comps = await list_competitions(session, user)
    ids = [c.id for c in comps]
    if not ids:
        return []
    r = await session.execute(
        select(CompetitionRegistration)
        .where(
            CompetitionRegistration.competition_id.in_(ids),
            CompetitionRegistration.payment_status == REG_PAY_PENDING_CONFIRMATION,
        )
        .order_by(CompetitionRegistration.updated_at.desc())
    )
    rows = list(r.scalars().all())
    return [await registration_to_read(session, x) for x in rows]


# --- weigh-in ---


async def search_registration_for_weigh_in(
    session: AsyncSession, user: User, competition_id: int, q: str
) -> list[schemas.WeighInSearchResult]:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    q = q.strip()
    if not q:
        return []
    stmt = (
        select(CompetitionRegistration, Student, CompetitionWeightClass)
        .join(Student, Student.id == CompetitionRegistration.student_id)
        .join(
            CompetitionWeightClass,
            CompetitionWeightClass.id == CompetitionRegistration.weight_class_id,
        )
        .where(CompetitionRegistration.competition_id == competition_id)
    )
    if q.isdigit():
        stmt = stmt.where(
            (Student.id == int(q))
            | (CompetitionRegistration.registration_public_code.ilike(f"%{q}%"))
        )
    else:
        stmt = stmt.where(Student.name.ilike(f"%{q}%"))
    r = await session.execute(stmt.limit(30))
    out: list[schemas.WeighInSearchResult] = []
    for reg, st, wc in r.all():
        rr = await registration_to_read(session, reg)
        out.append(
            schemas.WeighInSearchResult(
                registration=rr,
                student_name=st.name,
                weight_class_label=f"[{wc.modality}] {wc.label}",
            )
        )
    return out


async def weigh_in_registration(
    session: AsyncSession, user: User, competition_id: int, registration_id: int, payload: schemas.WeighInPayload
) -> CompetitionRegistration:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    reg = await session.get(CompetitionRegistration, registration_id)
    if reg is None or reg.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    if not _registration_payment_cleared(reg):
        raise HTTPException(
            status_code=400,
            detail="Confirme o pagamento da inscrição antes de pesar o atleta",
        )
    current_wc = await session.get(CompetitionWeightClass, reg.weight_class_id)
    if current_wc is None:
        raise HTTPException(status_code=400, detail="Categoria inválida")

    tol = 0.01
    out_of_current_category = (
        current_wc.max_weight_kg is not None
        and payload.actual_weight_kg > current_wc.max_weight_kg + tol
    )

    # Para reclassificar, consideramos apenas classes compatíveis com:
    # - mesma divisão de idade
    # - mesmo gênero
    # - mesma modalidade (Gi/No-Gi) da inscrição
    wclasses_r = await session.execute(
        select(CompetitionWeightClass).where(
            CompetitionWeightClass.competition_id == competition_id,
            CompetitionWeightClass.age_division_id == reg.age_division_id,
            CompetitionWeightClass.gender == reg.gender,
            CompetitionWeightClass.modality == current_wc.modality,
        )
    )
    wclasses = list(wclasses_r.scalars().all())
    if not wclasses:
        raise HTTPException(status_code=400, detail="Não há categorias de peso para reclassificação")

    if not out_of_current_category:
        reg.status = "weighed_in"
        reg.actual_weight_kg = payload.actual_weight_kg
        reg.weigh_in_at = _now()
        reg.weigh_in_notes = payload.notes
        reg.updated_at = _now()
        await session.commit()
        await session.refresh(reg)
        return reg

    # Peso fora do limite: sugere reclassificação (se existir) antes de confirmar.
    def _max_or_inf(wc: CompetitionWeightClass) -> float:
        return float("inf") if wc.max_weight_kg is None else wc.max_weight_kg

    wclasses_sorted = sorted(wclasses, key=lambda w: (_max_or_inf(w), w.sort_order, w.id))

    suggested_wc: CompetitionWeightClass | None = None
    for wc_opt in wclasses_sorted:
        if wc_opt.max_weight_kg is None:
            suggested_wc = wc_opt
            break
        if payload.actual_weight_kg <= wc_opt.max_weight_kg + tol:
            suggested_wc = wc_opt
            break

    # Se não existir categoria compatível, desclassifica diretamente.
    if suggested_wc is None:
        reg.status = "disqualified"
    else:
        # O front precisa decidir (reclassificar ou desclassificar) se ainda não decidiu.
        if payload.reclassify_decision is None:
            # 409 = conflito de regra: precisa da decisão do usuário.
            raise HTTPException(
                status_code=409,
                detail={
                    "type": "reclassification_required",
                    "current_weight_class_label": f"[{current_wc.modality}] {current_wc.label}",
                    "suggested_weight_class_id": suggested_wc.id,
                    "suggested_weight_class_label": f"[{suggested_wc.modality}] {suggested_wc.label}",
                },
            )

        if payload.reclassify_decision == "reclassify":
            reg.weight_class_id = suggested_wc.id
            reg.status = "weighed_in"
        else:
            # disqualify
            reg.status = "disqualified"

    reg.actual_weight_kg = payload.actual_weight_kg
    reg.weigh_in_at = _now()
    reg.weigh_in_notes = payload.notes
    reg.updated_at = _now()

    fcm_token: str | None = None
    weight_class_changed = reg.status == "weighed_in" and reg.weight_class_id != current_wc.id
    if weight_class_changed:
        st = await session.get(Student, reg.student_id)
        if st and st.user_id:
            u = await session.get(User, st.user_id)
            if u:
                fcm_token = u.fcm_token
                session.add(
                    NotificationOutbox(
                        user_id=u.id,
                        title="Categoria alterada",
                        body=f"Sua categoria em {comp.name} foi ajustada com base na pesagem.",
                        payload_json=json.dumps({"competition_id": competition_id, "registration_id": reg.id}),
                    )
                )

    await session.commit()
    await session.refresh(reg)

    if weight_class_changed and fcm_token:
        from app.modules.competitions.fcm import send_fcm_notification_if_configured

        send_fcm_notification_if_configured(
            fcm_token,
            "Categoria alterada",
            f"Sua categoria em {comp.name} foi ajustada automaticamente com base na pesagem.",
        )

    return reg


async def get_registration_by_code(
    session: AsyncSession, user: User, competition_id: int, code: str
) -> CompetitionRegistration:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    r = await session.execute(
        select(CompetitionRegistration).where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.registration_public_code == code.strip(),
        )
    )
    reg = r.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Código não encontrado")
    return reg


async def update_ranking_points(
    session: AsyncSession, user: User, competition_id: int, registration_id: int, points: float
) -> CompetitionRegistration:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    reg = await session.get(CompetitionRegistration, registration_id)
    if reg is None or reg.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    reg.ranking_points = points
    reg.updated_at = _now()
    await session.commit()
    await session.refresh(reg)
    return reg


# --- bracket ---


async def generate_bracket(
    session: AsyncSession,
    user: User,
    competition_id: int,
    age_division_id: int,
    weight_class_id: int,
    gender: str,
) -> schemas.BracketGenerateResponse:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)

    r_exist = await session.execute(
        select(CompetitionBracket).where(
            CompetitionBracket.competition_id == competition_id,
            CompetitionBracket.age_division_id == age_division_id,
            CompetitionBracket.weight_class_id == weight_class_id,
            CompetitionBracket.gender == gender,
        )
    )
    existing = r_exist.scalar_one_or_none()
    if existing:
        await session.execute(delete(CompetitionMatch).where(CompetitionMatch.bracket_id == existing.id))
        await session.execute(delete(CompetitionBracket).where(CompetitionBracket.id == existing.id))
        await session.flush()

    r_regs = await session.execute(
        select(CompetitionRegistration).where(
            CompetitionRegistration.competition_id == competition_id,
            CompetitionRegistration.age_division_id == age_division_id,
            CompetitionRegistration.weight_class_id == weight_class_id,
            CompetitionRegistration.gender == gender,
            CompetitionRegistration.status == "weighed_in",
        )
    )
    regs = [r for r in r_regs.scalars().all() if _registration_payment_cleared(r)]
    if len(regs) < 2:
        raise HTTPException(
            status_code=400,
            detail="É necessário pelo menos 2 atletas pesados (weighed_in) para gerar chave",
        )

    regs_sorted = sorted(regs, key=lambda x: (-x.ranking_points, x.id))
    student_by_reg = {r.id: await session.get(Student, r.student_id) for r in regs_sorted}

    def dojo_key(r: CompetitionRegistration) -> int | None:
        st = student_by_reg.get(r.id)
        return st.dojo_id if st else None

    optimized = try_reduce_same_dojo_pairings(regs_sorted, dojo_key)
    m = len(optimized)

    # Modelo clássico de torneio eliminatório:
    # sempre expandimos para a próxima potência de 2 e montamos
    # a árvore completa (oitavas/quartas/semifinais/final quando aplicável).
    # Slots vazios (byes) são resolvidos automaticamente como WO em cascata.
    n = next_power_of_2(m)

    warnings_parts: list[str] = []

    bracket = CompetitionBracket(
        competition_id=competition_id,
        age_division_id=age_division_id,
        weight_class_id=weight_class_id,
        gender=gender,
        team_separation_warnings=None,  # preenchido logo abaixo
    )
    session.add(bracket)
    await session.flush()

    positions = bracket_seed_positions(n)
    slots: list[CompetitionRegistration | None] = [None] * n
    for seed in range(1, len(optimized) + 1):
        idx = positions.index(seed)
        slots[idx] = optimized[seed - 1]

    for p in range(0, n, 2):
        a, b = slots[p], slots[p + 1]
        if a and b and dojo_key(a) == dojo_key(b) and dojo_key(a) is not None:
            warnings_parts.append(f"Mesma academia na primeira rodada (dojo {dojo_key(a)})")

    bracket.team_separation_warnings = "\n".join(warnings_parts) if warnings_parts else None
    await session.flush()

    rounds_count = int(math.log2(n))
    matches_by_round: list[list[CompetitionMatch]] = [[] for _ in range(rounds_count)]

    for p in range(n // 2):
        red, blue = slots[2 * p], slots[2 * p + 1]
        m0 = CompetitionMatch(
            bracket_id=bracket.id,
            round_index=0,
            position_in_round=p,
            red_registration_id=red.id if red else None,
            blue_registration_id=blue.id if blue else None,
            match_status="scheduled",
        )
        session.add(m0)
        matches_by_round[0].append(m0)
    await session.flush()

    for r in range(1, rounds_count):
        prev = matches_by_round[r - 1]
        count = len(prev) // 2
        for p in range(count):
            left, right = prev[2 * p], prev[2 * p + 1]
            mr = CompetitionMatch(
                bracket_id=bracket.id,
                round_index=r,
                position_in_round=p,
                feeder_red_match_id=left.id,
                feeder_blue_match_id=right.id,
                match_status="scheduled",
            )
            session.add(mr)
            matches_by_round[r].append(mr)
        await session.flush()

    # Propaga byes: atleta sem adversário na 1ª rodada avança direto para a próxima.
    # No Jiu-Jitsu, "bye" (folga) é silencioso — o atleta avança sem uma luta registrada.
    # Por isso, ao invés de criar um match de WO visível, propagamos o atleta para o slot
    # da rodada seguinte e depois DELETAMOS o match de bye.
    children_by_feeder: dict[int, list[CompetitionMatch]] = defaultdict(list)
    all_matches: list[CompetitionMatch] = [m for round_matches in matches_by_round for m in round_matches]
    for cm in all_matches:
        if cm.feeder_red_match_id is not None:
            children_by_feeder[cm.feeder_red_match_id].append(cm)
        if cm.feeder_blue_match_id is not None:
            children_by_feeder[cm.feeder_blue_match_id].append(cm)

    # Passo 1: propaga winners dos byes na 1ª rodada para os slots da próxima.
    # (ainda não deletamos — precisamos do cm.id para encontrar os filhos)
    changed = True
    while changed:
        changed = False
        for cm in all_matches:
            if cm.round_index != 0:
                continue
            if cm.match_status != "scheduled" or cm.winner_registration_id is not None:
                continue
            red_id = cm.red_registration_id
            blue_id = cm.blue_registration_id
            if red_id is None and blue_id is None:
                continue  # double-bye: nenhum atleta, nada a propagar
            if red_id is not None and blue_id is not None:
                continue  # luta real: não toca

            winner_id = red_id if red_id is not None else blue_id
            cm.winner_registration_id = winner_id
            cm.finish_method = "wo"
            cm.referee_decision_used = False
            cm.match_status = "completed"
            cm.ended_at = _now()

            for nxt in children_by_feeder.get(cm.id, []):
                if nxt.feeder_red_match_id == cm.id:
                    nxt.red_registration_id = winner_id
                if nxt.feeder_blue_match_id == cm.id:
                    nxt.blue_registration_id = winner_id
            changed = True

    await session.flush()

    # Passo 2: REMOVE matches de bye (WO) e double-bye da 1ª rodada.
    # Os atletas já foram propagados para os slots diretos da próxima rodada (acima).
    # Limpar feeder_X_match_id garante que a próxima rodada usa o atleta diretamente
    # sem depender do match de bye deletado.
    match_by_id: dict[int, CompetitionMatch] = {cm.id: cm for cm in all_matches}
    bye_ids: set[int] = set()
    for cm in all_matches:
        if cm.round_index != 0:
            continue
        is_bye_wo = cm.match_status == "completed" and cm.finish_method == "wo"
        is_double_bye = cm.red_registration_id is None and cm.blue_registration_id is None
        if is_bye_wo or is_double_bye:
            bye_ids.add(cm.id)

    for cm in all_matches:
        if cm.round_index == 0:
            continue
        if cm.feeder_red_match_id in bye_ids:
            cm.feeder_red_match_id = None
        if cm.feeder_blue_match_id in bye_ids:
            cm.feeder_blue_match_id = None

    for mid in bye_ids:
        obj = match_by_id.get(mid)
        if obj:
            await session.delete(obj)

    all_matches = [cm for cm in all_matches if cm.id not in bye_ids]
    await session.flush()

    # Passo 3: remove recursivamente matches "órfãos" em rodadas superiores
    # (sem atleta direto E sem feeder algum — surgem quando toda a sub-árvore eram byes).
    changed = True
    while changed:
        changed = False
        orphan_ids: set[int] = set()
        for cm in all_matches:
            has_athlete = cm.red_registration_id is not None or cm.blue_registration_id is not None
            has_feeder = cm.feeder_red_match_id is not None or cm.feeder_blue_match_id is not None
            if not has_athlete and not has_feeder:
                orphan_ids.add(cm.id)
        if orphan_ids:
            for cm in all_matches:
                if cm.feeder_red_match_id in orphan_ids:
                    cm.feeder_red_match_id = None
                if cm.feeder_blue_match_id in orphan_ids:
                    cm.feeder_blue_match_id = None
            for mid in orphan_ids:
                obj = match_by_id.get(mid)
                if obj:
                    await session.delete(obj)
            all_matches = [cm for cm in all_matches if cm.id not in orphan_ids]
            await session.flush()
            match_by_id = {cm.id: cm for cm in all_matches}
            changed = True

    total_matches = len(all_matches)
    await session.commit()
    await session.refresh(bracket)
    return schemas.BracketGenerateResponse(
        bracket_id=bracket.id,
        matches_created=total_matches,
        warnings=bracket.team_separation_warnings,
    )


async def generate_all_brackets(
    session: AsyncSession,
    user: User,
    competition_id: int,
) -> schemas.BracketsGenerateAllResponse:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)

    wclasses_stmt = select(CompetitionWeightClass).where(CompetitionWeightClass.competition_id == competition_id)
    wclasses = list((await session.execute(wclasses_stmt)).scalars().all())
    total = len(wclasses)

    generated_ids: list[int] = []
    warnings: list[str] = []
    skipped = 0

    cleared_payments = [REG_PAY_NOT_APPLICABLE, REG_PAY_CONFIRMED]

    for wc in wclasses:
        # Verifica se há ao menos 2 atletas com pesagem confirmada e pagamento "ok"
        # (na prática a chave não é gerada se não houver 2).
        cnt_stmt = (
            select(func.count())
            .select_from(CompetitionRegistration)
            .where(
                CompetitionRegistration.competition_id == competition_id,
                CompetitionRegistration.age_division_id == wc.age_division_id,
                CompetitionRegistration.weight_class_id == wc.id,
                CompetitionRegistration.gender == wc.gender,
                CompetitionRegistration.status == "weighed_in",
                CompetitionRegistration.payment_status.in_(cleared_payments),
            )
        )
        count = int((await session.execute(cnt_stmt)).scalar_one())
        if count < 2:
            skipped += 1
            continue

        res = await generate_bracket(
            session,
            user,
            competition_id,
            wc.age_division_id,
            wc.id,
            wc.gender,
        )
        generated_ids.append(res.bracket_id)
        if res.warnings:
            warnings.append(res.warnings)

    return schemas.BracketsGenerateAllResponse(
        total_weight_classes_to_check=total,
        generated_brackets=len(generated_ids),
        skipped_weight_classes=skipped,
        generated_bracket_ids=generated_ids,
        warnings=warnings,
    )


async def promote_registration(
    session: AsyncSession,
    user: User,
    competition_id: int,
    registration_id: int,
    payload: schemas.PromoteRegistrationPayload,
) -> CompetitionRegistration:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    reg = await session.get(CompetitionRegistration, registration_id)
    if reg is None or reg.competition_id != competition_id:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    new_ad = payload.target_age_division_id or reg.age_division_id
    new_wc = payload.target_weight_class_id or reg.weight_class_id
    student = await session.get(Student, reg.student_id)
    if student is None:
        raise HTTPException(status_code=400, detail="Aluno inválido")
    await _validate_registration_eligibility(
        session,
        comp,
        student,
        reg.gender,
        new_ad,
        new_wc,
        skip_belt_check=student.faixa_id is None,
        declared_weight_kg=reg.declared_weight_kg,
    )

    reg.age_division_id = new_ad
    reg.weight_class_id = new_wc
    reg.status = "registered"
    reg.actual_weight_kg = None
    reg.weigh_in_at = None
    reg.updated_at = _now()
    await session.commit()

    u: User | None = None
    if student.user_id:
        ur = await session.execute(select(User).where(User.id == student.user_id))
        u = ur.scalar_one_or_none()
    if u:
        session.add(
            NotificationOutbox(
                user_id=u.id,
                title="Categoria alterada",
                body=f"Sua categoria na competição {comp.name} foi alterada pelo organizador. Refaça a pesagem se necessário.",
                payload_json=json.dumps({"competition_id": competition_id, "registration_id": reg.id}),
            )
        )
        await session.commit()
        await session.refresh(u)
        from app.modules.competitions.fcm import send_fcm_notification_if_configured

        if u.fcm_token:
            send_fcm_notification_if_configured(
                u.fcm_token,
                "Categoria alterada",
                f"Sua categoria em {comp.name} foi alterada. Refaça a pesagem se necessário.",
            )

    await session.refresh(reg)
    return reg


# --- mats ---


async def create_mat(session: AsyncSession, user: User, competition_id: int, payload: schemas.MatCreate) -> CompetitionMat:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    m = CompetitionMat(
        competition_id=competition_id,
        name=payload.name,
        display_order=payload.display_order,
    )
    session.add(m)
    await session.commit()
    await session.refresh(m)
    return m


async def list_mats(session: AsyncSession, user: User, competition_id: int) -> list[CompetitionMat]:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    r = await session.execute(
        select(CompetitionMat)
        .where(CompetitionMat.competition_id == competition_id)
        .order_by(CompetitionMat.display_order, CompetitionMat.id)
    )
    return list(r.scalars().all())


async def assign_match_mat(
    session: AsyncSession,
    user: User,
    competition_id: int,
    match_id: int,
    payload: schemas.AssignMatchMatPayload,
) -> CompetitionMatch:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    m = await session.get(CompetitionMatch, match_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Luta não encontrada")
    br = await session.get(CompetitionBracket, m.bracket_id)
    if br is None or br.competition_id != competition_id:
        raise HTTPException(status_code=400, detail="Luta não pertence à competição")
    m.mat_id = payload.mat_id
    if payload.queue_order is not None:
        m.queue_order = payload.queue_order
    await session.commit()
    await session.refresh(m)
    await recompute_mat_schedule(session, competition_id)
    return m


async def recompute_mat_schedule(session: AsyncSession, competition_id: int) -> None:
    comp = await _get_competition(session, competition_id)
    if comp is None or comp.event_starts_at is None:
        return
    dur = comp.default_match_duration_seconds
    buf = comp.transition_buffer_seconds
    step = dur + buf

    r_mats = await session.execute(
        select(CompetitionMat).where(CompetitionMat.competition_id == competition_id)
    )
    mats = list(r_mats.scalars().all())
    for mat in mats:
        r_matches = await session.execute(
            select(CompetitionMatch)
            .where(
                CompetitionMatch.mat_id == mat.id,
                CompetitionMatch.round_index == 0,
            )
            .order_by(CompetitionMatch.queue_order.nulls_last(), CompetitionMatch.id)
        )
        matches = list(r_matches.scalars().all())
        t = comp.event_starts_at
        for m in matches:
            m.estimated_start_at = t
            t = t + timedelta(seconds=step)
    await session.commit()


async def _match_names(session: AsyncSession, m: CompetitionMatch) -> tuple[str | None, str | None]:
    rn = bn = None
    if m.red_registration_id:
        reg = await session.get(CompetitionRegistration, m.red_registration_id)
        if reg:
            st = await session.get(Student, reg.student_id)
            rn = st.name if st else None
    if m.blue_registration_id:
        reg = await session.get(CompetitionRegistration, m.blue_registration_id)
        if reg:
            st = await session.get(Student, reg.student_id)
            bn = st.name if st else None
    return rn, bn


async def public_mat_statuses(session: AsyncSession, public_token: str) -> list[schemas.PublicMatStatus]:
    r = await session.execute(select(Competition).where(Competition.public_display_token == public_token))
    comp = r.scalar_one_or_none()
    if comp is None:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    r_mats = await session.execute(
        select(CompetitionMat)
        .where(CompetitionMat.competition_id == comp.id)
        .order_by(CompetitionMat.display_order, CompetitionMat.id)
    )
    mats = list(r_mats.scalars().all())
    out: list[schemas.PublicMatStatus] = []
    now = _now()
    dur = comp.default_match_duration_seconds
    buf = comp.transition_buffer_seconds
    dur_td = timedelta(seconds=dur)
    buf_td = timedelta(seconds=buf)
    for mat in mats:
        r_all = await session.execute(
            select(CompetitionMatch)
            .join(CompetitionBracket, CompetitionBracket.id == CompetitionMatch.bracket_id)
            .where(
                CompetitionBracket.competition_id == comp.id,
                CompetitionMatch.mat_id == mat.id,
                CompetitionMatch.round_index == 0,
            )
            .order_by(CompetitionMatch.queue_order.nulls_last(), CompetitionMatch.estimated_start_at.nulls_last(), CompetitionMatch.id)
        )
        ordered = list(r_all.scalars().all())

        def is_on_mat_time(mm: CompetitionMatch) -> bool:
            if mm.match_status in ("completed", "cancelled"):
                return False
            if mm.estimated_start_at is None:
                return False
            start = mm.estimated_start_at
            end = start + dur_td
            return start <= now < end

        def is_on_deck_time(mm: CompetitionMatch) -> bool:
            if mm.match_status in ("completed", "cancelled"):
                return False
            if mm.estimated_start_at is None:
                return False
            start = mm.estimated_start_at
            return now < start <= now + buf_td

        def is_completed_time(mm: CompetitionMatch) -> bool:
            if mm.match_status in ("completed", "cancelled"):
                return True
            if mm.estimated_start_at is None:
                return False
            start = mm.estimated_start_at
            end = start + dur_td
            return now >= end

        # Prioridade:
        # - Se o relógio já "entrou" na janela, mostrar automaticamente.
        # - Se não, respeitar o que o organizador setou manualmente (match_status).
        time_on_mat = next((x for x in ordered if is_on_mat_time(x)), None)
        manual_on_mat = next((x for x in ordered if x.match_status == "on_mat"), None)
        if manual_on_mat is not None and manual_on_mat.estimated_start_at is not None:
            # Se já passou do fim previsto, não deveria continuar no tatame.
            if is_completed_time(manual_on_mat):
                manual_on_mat = None

        on_mat = time_on_mat or manual_on_mat

        time_on_deck = next((x for x in ordered if is_on_deck_time(x)), None)
        manual_on_deck = next((x for x in ordered if x.match_status == "on_deck"), None)
        if manual_on_deck is not None and manual_on_deck.estimated_start_at is not None:
            # Se já começou (ou passou), não faz sentido ficar na borda.
            if manual_on_deck.estimated_start_at <= now:
                manual_on_deck = None

        on_deck = time_on_deck or manual_on_deck

        warm_ids = {x.id for x in (on_mat, on_deck) if x}
        scheduled_like = [
            x
            for x in ordered
            if x.match_status in ("scheduled", "warm_up")
            and x.id not in warm_ids
            # Não mostrar itens que já deveriam ter saído do painel.
            and not (is_on_mat_time(x) or is_on_deck_time(x) or is_completed_time(x))
        ]
        warm = [await _to_public_brief(session, x) for x in scheduled_like[:3]]

        async def brief(mm: CompetitionMatch | None) -> schemas.PublicMatchBrief | None:
            if mm is None:
                return None
            return await _to_public_brief(session, mm)

        out.append(
            schemas.PublicMatStatus(
                mat=schemas.MatRead.model_validate(mat),
                on_mat=await brief(on_mat),
                on_deck=await brief(on_deck),
                warm_up=warm,
            )
        )
    return out


async def _to_public_brief(session: AsyncSession, m: CompetitionMatch) -> schemas.PublicMatchBrief:
    rn, bn = await _match_names(session, m)
    return schemas.PublicMatchBrief(
        id=m.id,
        mat_id=m.mat_id,
        queue_order=m.queue_order,
        estimated_start_at=m.estimated_start_at,
        match_status=m.match_status,
        red_name=rn,
        blue_name=bn,
    )


# --- scorekeeper ---


async def update_match_scores(
    session: AsyncSession, user: User, competition_id: int, match_id: int, payload: schemas.MatchScoreUpdate
) -> CompetitionMatch:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    m = await session.get(CompetitionMatch, match_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Luta não encontrada")
    br = await session.get(CompetitionBracket, m.bracket_id)
    if br is None or br.competition_id != competition_id:
        raise HTTPException(status_code=400, detail="Luta inválida")
    data = payload.model_dump(exclude_unset=True)
    if "timer_running" in data and data["timer_running"] is False:
        m.paused_for = data.get("paused_for", m.paused_for)
    for k, v in data.items():
        setattr(m, k, v)
    await session.commit()
    await session.refresh(m)
    return m


async def finish_match(
    session: AsyncSession, user: User, competition_id: int, match_id: int, payload: schemas.MatchFinishPayload
) -> CompetitionMatch:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    m = await session.get(CompetitionMatch, match_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Luta não encontrada")
    br = await session.get(CompetitionBracket, m.bracket_id)
    if br is None or br.competition_id != competition_id:
        raise HTTPException(status_code=400, detail="Luta inválida")

    finish_method = payload.finish_method.strip().lower()
    allowed_finish_methods = {
        "finalization",
        "points_victory",
        "disqualification",
        "tie_referee",
        "tie_draw",
        "wo",
    }
    if finish_method not in allowed_finish_methods:
        raise HTTPException(status_code=400, detail="Método de finalização inválido")

    is_tie = m.red_score == m.blue_score

    def winner_registration_id_for_side(side: str) -> int | None:
        if side == "red":
            return m.red_registration_id
        if side == "blue":
            return m.blue_registration_id
        # "none"
        return None

    wid: int | None = None

    if finish_method in ("disqualification", "wo"):
        # Desclassificação / WO ignoram placar: o vencedor é definido pelo lado selecionado.
        if payload.referee_decision:
            raise HTTPException(status_code=400, detail="Decisão de árbitro só em empates")
        if payload.winner_side not in ("red", "blue"):
            raise HTTPException(status_code=400, detail="Selecione o lado vencedor")
        wid = winner_registration_id_for_side(payload.winner_side)

    elif finish_method == "tie_draw":
        # Empate sem vencedor: winner fica null.
        next_match_exists = await session.scalar(
            select(func.count())
            .select_from(CompetitionMatch)
            .where(
                or_(
                    CompetitionMatch.feeder_red_match_id == m.id,
                    CompetitionMatch.feeder_blue_match_id == m.id,
                )
            )
        )
        if next_match_exists and int(next_match_exists) > 0:
            raise HTTPException(
                status_code=400,
                detail="Empate sem vencedor não é permitido em chave eliminatória",
            )
        if not is_tie:
            raise HTTPException(status_code=400, detail="Empate sem vencedor exige placar empatado")
        if payload.referee_decision:
            raise HTTPException(status_code=400, detail="Empate sem vencedor não usa decisão de árbitro")
        if payload.winner_side != "none":
            raise HTTPException(status_code=400, detail="Empate sem vencedor requer winner_side=none")
        wid = None

    elif finish_method == "tie_referee":
        # Empate com vencedor decidido pelo juiz.
        if not is_tie:
            raise HTTPException(status_code=400, detail="Empate com vencedor exige placar empatado")
        if not payload.referee_decision:
            raise HTTPException(status_code=400, detail="Empate com vencedor exige decisão de árbitro")
        if payload.winner_side not in ("red", "blue"):
            raise HTTPException(status_code=400, detail="Selecione o vencedor do juiz")
        wid = winner_registration_id_for_side(payload.winner_side)

    elif finish_method in ("finalization", "points_victory"):
        # Finalização/pontos: se houver empate, a vitória só pode ser decidida pelo árbitro.
        if is_tie:
            if not payload.referee_decision:
                raise HTTPException(
                    status_code=400,
                    detail="Empate: marque decisão de árbitro ou ajuste o método para empate sem vencedor",
                )
            if payload.winner_side not in ("red", "blue"):
                raise HTTPException(status_code=400, detail="Selecione o vencedor decidido pelo árbitro")
            wid = winner_registration_id_for_side(payload.winner_side)
        else:
            if payload.referee_decision:
                raise HTTPException(status_code=400, detail="Decisão de árbitro só em empate absoluto")
            expected = "red" if m.red_score > m.blue_score else "blue"
            if payload.winner_side != expected:
                raise HTTPException(status_code=400, detail="Vencedor não corresponde ao placar")
            wid = winner_registration_id_for_side(expected)

    # Validação final para métodos que precisam de vencedor.
    if wid is None and finish_method != "tie_draw":
        raise HTTPException(status_code=400, detail="Lado vencedor sem atleta")

    m.winner_registration_id = wid
    m.finish_method = finish_method
    m.referee_decision_used = payload.referee_decision
    m.match_status = "completed"
    m.ended_at = _now()
    m.timer_running = False

    nxt = await session.execute(
        select(CompetitionMatch).where(
            or_(
                CompetitionMatch.feeder_red_match_id == m.id,
                CompetitionMatch.feeder_blue_match_id == m.id,
            )
        )
    )
    for cm in nxt.scalars().all():
        if cm.feeder_red_match_id == m.id:
            cm.red_registration_id = wid
        elif cm.feeder_blue_match_id == m.id:
            cm.blue_registration_id = wid
        # Chaves geradas com bug antigo: final/semifinal podia ser fechada por WO com só 1 lado
        # preenchido. Ao chegar o 2º vencedor, reabre para a luta valer.
        if (
            wid is not None
            and cm.round_index >= 1
            and cm.feeder_red_match_id is not None
            and cm.feeder_blue_match_id is not None
            and cm.red_registration_id is not None
            and cm.blue_registration_id is not None
            and cm.match_status == "completed"
            and cm.finish_method == "wo"
        ):
            cm.match_status = "scheduled"
            cm.winner_registration_id = None
            cm.finish_method = None
            cm.ended_at = None
            cm.referee_decision_used = False
            cm.timer_running = False

    await session.commit()
    await session.refresh(m)
    return m


async def set_match_display_status(
    session: AsyncSession, user: User, competition_id: int, match_id: int, display_status: str
) -> CompetitionMatch:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    m = await session.get(CompetitionMatch, match_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Luta não encontrada")
    br = await session.get(CompetitionBracket, m.bracket_id)
    if br is None or br.competition_id != competition_id:
        raise HTTPException(status_code=400, detail="Luta inválida")
    if display_status not in ("scheduled", "warm_up", "on_deck", "on_mat", "completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Status inválido")
    m.match_status = display_status
    if display_status == "on_mat":
        m.started_at = m.started_at or _now()
    await session.commit()
    await session.refresh(m)
    return m


# --- coach ---


async def coach_dashboard(
    session: AsyncSession, user: User, competition_id: int
) -> schemas.CoachDashboardResponse:
    if user.role != "admin" or user.dojo_id is None:
        raise HTTPException(status_code=403, detail="Apenas professor do dojo")
    comp = await _get_competition(session, competition_id)
    if comp is None:
        raise HTTPException(status_code=404, detail="Competição não encontrada")

    r_regs = await session.execute(
        select(CompetitionRegistration, Student)
        .join(Student, Student.id == CompetitionRegistration.student_id)
        .where(
            CompetitionRegistration.competition_id == competition_id,
            Student.dojo_id == user.dojo_id,
        )
    )
    rows = list(r_regs.all())
    reg_ids = {reg.id for reg, _ in rows}
    student_by_reg = {reg.id: st for reg, st in rows}

    fights: list[schemas.CoachStudentFight] = []
    intervals: list[tuple[str, str | None, datetime, datetime]] = []

    if reg_ids:
        r_m = await session.execute(
            select(CompetitionMatch, CompetitionMat)
            .outerjoin(CompetitionMat, CompetitionMat.id == CompetitionMatch.mat_id)
            .join(CompetitionBracket, CompetitionBracket.id == CompetitionMatch.bracket_id)
            .where(
                CompetitionBracket.competition_id == competition_id,
                CompetitionMatch.round_index == 0,
            )
        )
        seen_reg: set[int] = set()
        for m, mat in r_m.all():
            for rid in (m.red_registration_id, m.blue_registration_id):
                if rid is None or rid not in reg_ids or rid in seen_reg:
                    continue
                seen_reg.add(rid)
                st = student_by_reg[rid]
                fights.append(
                    schemas.CoachStudentFight(
                        registration_id=rid,
                        student_id=st.id,
                        student_name=st.name,
                        match_id=m.id,
                        mat_name=mat.name if mat else None,
                        estimated_start_at=m.estimated_start_at,
                        match_status=m.match_status,
                    )
                )
                if m.estimated_start_at is not None:
                    dur = comp.default_match_duration_seconds
                    intervals.append(
                        (
                            st.name,
                            mat.name if mat else None,
                            m.estimated_start_at,
                            m.estimated_start_at + timedelta(seconds=dur),
                        )
                    )

    conflicts: list[schemas.CoachConflict] = []
    n = len(intervals)
    for i in range(n):
        for j in range(i + 1, n):
            na, ma, a0, a1 = intervals[i]
            nb, mb, b0, b1 = intervals[j]
            if na == nb:
                continue
            if a0 < b1 and b0 < a1:
                conflicts.append(
                    schemas.CoachConflict(
                        student_a_name=na,
                        student_b_name=nb,
                        mat_a=ma,
                        mat_b=mb,
                        overlap_start=max(a0, b0),
                        overlap_end=min(a1, b1),
                    )
                )

    return schemas.CoachDashboardResponse(fights=fights, conflicts=conflicts)


async def list_matches_for_competition(
    session: AsyncSession, user: User, competition_id: int
) -> list[CompetitionMatch]:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    r = await session.execute(
        select(CompetitionMatch)
        .join(CompetitionBracket, CompetitionBracket.id == CompetitionMatch.bracket_id)
        .where(CompetitionBracket.competition_id == competition_id)
        .order_by(CompetitionMatch.bracket_id, CompetitionMatch.round_index, CompetitionMatch.position_in_round)
    )
    return list(r.scalars().all())


async def list_brackets(session: AsyncSession, user: User, competition_id: int) -> list[CompetitionBracket]:
    comp = await get_competition(session, user, competition_id)
    _assert_organizer(comp, user)
    r = await session.execute(
        select(CompetitionBracket).where(CompetitionBracket.competition_id == competition_id)
    )
    return list(r.scalars().all())


# --- FCM ---


async def save_fcm_token(session: AsyncSession, user: User, token: str) -> None:
    user.fcm_token = token
    await session.commit()


async def list_notifications(session: AsyncSession, user: User) -> list[NotificationOutbox]:
    r = await session.execute(
        select(NotificationOutbox)
        .where(NotificationOutbox.user_id == user.id)
        .order_by(NotificationOutbox.created_at.desc())
        .limit(50)
    )
    return list(r.scalars().all())
