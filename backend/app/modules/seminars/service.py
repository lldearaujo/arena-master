from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from jose import jwt
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.models.seminar import (
    Seminar,
    SeminarAttendance,
    SeminarLot,
    SeminarRegistration,
    SeminarScheduleItem,
)
from app.models.user import User


def _assert_admin_can_access(admin: User, seminar: Seminar) -> None:
    if admin.role == "superadmin":
        return
    if admin.role != "admin":
        raise HTTPException(status_code=403, detail="Sem permissão")
    if admin.dojo_id != seminar.organizer_dojo_id:
        raise HTTPException(status_code=403, detail="Sem permissão")


async def list_seminars(session: AsyncSession, user: User) -> list[Seminar]:
    stmt = select(Seminar)
    if user.role == "aluno":
        stmt = stmt.where(Seminar.is_published.is_(True))
        # Visibilidade:
        # - public: qualquer usuário pode ver
        # - internal: apenas alunos do dojo organizador
        if user.dojo_id:
            stmt = stmt.where(or_(Seminar.visibility == "public", Seminar.organizer_dojo_id == user.dojo_id))
        else:
            stmt = stmt.where(Seminar.visibility == "public")
    elif user.role == "admin":
        if not user.dojo_id:
            return []
        stmt = stmt.where(Seminar.organizer_dojo_id == user.dojo_id)
    # Postgres espera: `<expr> DESC NULLS LAST` (não `NULLS LAST DESC`)
    stmt = stmt.order_by(Seminar.starts_at.desc().nulls_last(), Seminar.id.desc())
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def get_seminar(session: AsyncSession, seminar_id: int) -> Seminar:
    res = await session.execute(select(Seminar).where(Seminar.id == seminar_id))
    seminar = res.scalar_one_or_none()
    if seminar is None:
        raise HTTPException(status_code=404, detail="Seminário não encontrado")
    return seminar


async def create_seminar(session: AsyncSession, admin: User, payload) -> Seminar:
    if admin.role not in {"admin", "superadmin"}:
        raise HTTPException(status_code=403, detail="Sem permissão")
    if admin.role == "admin" and admin.dojo_id != payload.organizer_dojo_id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    s = Seminar(
        organizer_dojo_id=payload.organizer_dojo_id,
        title=payload.title,
        description=payload.description,
        banner_url=payload.banner_url,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        location_city=getattr(payload, "location_city", None),
        location_state=getattr(payload, "location_state", None),
        location_text=payload.location_text,
        speaker_name=payload.speaker_name,
        speaker_bio=payload.speaker_bio,
        speaker_photo_url=payload.speaker_photo_url,
        speaker_achievements=payload.speaker_achievements,
        capacity=payload.capacity,
        is_published=payload.is_published,
        visibility=getattr(payload, "visibility", "internal") or "internal",
    )
    session.add(s)
    await session.commit()
    await session.refresh(s)
    return s


async def update_seminar(session: AsyncSession, admin: User, seminar_id: int, payload) -> Seminar:
    s = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, s)

    for field in [
        "title",
        "description",
        "banner_url",
        "starts_at",
        "ends_at",
        "location_city",
        "location_state",
        "location_text",
        "speaker_name",
        "speaker_bio",
        "speaker_photo_url",
        "speaker_achievements",
        "capacity",
        "is_published",
        "visibility",
    ]:
        val = getattr(payload, field)
        if val is not None:
            setattr(s, field, val)

    await session.commit()
    await session.refresh(s)
    return s


async def set_published(session: AsyncSession, admin: User, seminar_id: int, published: bool) -> Seminar:
    s = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, s)
    s.is_published = published
    await session.commit()
    await session.refresh(s)
    if published:
        # Promoção segmentada (MVP): dispara push para usuários do dojo organizador.
        title = "Novo seminário disponível"
        when = ""
        if s.starts_at:
            try:
                when = f" ({s.starts_at.date().isoformat()})"
            except Exception:
                when = ""
        body = f"{s.title}{when}. Toque para ver detalhes e garantir sua vaga."
        await push_to_dojo_users(
            session,
            dojo_id=s.organizer_dojo_id,
            title=title,
            body=body,
            payload={"seminar_id": s.id},
        )
    return s


async def upload_banner(session: AsyncSession, admin: User, seminar_id: int, file: UploadFile) -> Seminar:
    s = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, s)

    # Salva em backend/static/seminar-banners/
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=400, detail="Formato inválido (use jpg/png/webp)")

    static_dir = Path(__file__).resolve().parents[4] / "static" / "seminar-banners"
    static_dir.mkdir(parents=True, exist_ok=True)
    filename = f"seminar_{seminar_id}_banner{ext}"
    dest_path = static_dir / filename
    dest_path.write_bytes(await file.read())
    s.banner_url = f"/static/seminar-banners/{filename}"
    await session.commit()
    await session.refresh(s)
    return s


async def list_lots(session: AsyncSession, seminar_id: int) -> list[SeminarLot]:
    res = await session.execute(
        select(SeminarLot)
        .where(SeminarLot.seminar_id == seminar_id)
        .order_by(SeminarLot.order.asc(), SeminarLot.starts_at.asc().nulls_last(), SeminarLot.id.asc())
    )
    return list(res.scalars().all())


async def add_lot(session: AsyncSession, admin: User, seminar_id: int, payload) -> SeminarLot:
    s = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, s)
    lot = SeminarLot(
        seminar_id=seminar_id,
        name=payload.name,
        price_amount=payload.price_amount,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        order=payload.order,
    )
    session.add(lot)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        # Constraint: um lote por (seminar_id, order)
        raw = str(getattr(e, "orig", "") or e).lower()
        if "uq_seminar_lot_order" in raw or "seminar_id" in raw and "\"order\"" in raw and "already exists" in raw:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um lote com essa ordem para este seminário.",
            )
        raise
    await session.refresh(lot)
    # Se o seminário já estiver publicado, avisar mudança de lote/preço (MVP).
    if s.is_published:
        title = "Atualização de lote"
        body = f"{s.title}: novo lote disponível ({lot.name})."
        await push_to_dojo_users(
            session,
            dojo_id=s.organizer_dojo_id,
            title=title,
            body=body,
            payload={"seminar_id": s.id},
        )
    return lot


async def delete_lot(session: AsyncSession, admin: User, seminar_id: int, lot_id: int) -> None:
    s = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, s)
    res = await session.execute(
        select(SeminarLot).where(SeminarLot.id == lot_id, SeminarLot.seminar_id == seminar_id)
    )
    lot = res.scalar_one_or_none()
    if lot is None:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    await session.delete(lot)
    await session.commit()


async def list_schedule_items(session: AsyncSession, seminar_id: int) -> list[SeminarScheduleItem]:
    res = await session.execute(
        select(SeminarScheduleItem)
        .where(SeminarScheduleItem.seminar_id == seminar_id)
        .order_by(SeminarScheduleItem.starts_at.asc().nulls_last(), SeminarScheduleItem.id.asc())
    )
    return list(res.scalars().all())


async def add_schedule_item(
    session: AsyncSession, admin: User, seminar_id: int, payload
) -> SeminarScheduleItem:
    s = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, s)
    item = SeminarScheduleItem(
        seminar_id=seminar_id,
        kind=payload.kind,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        title=payload.title,
        notes=payload.notes,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def delete_schedule_item(
    session: AsyncSession, admin: User, seminar_id: int, item_id: int
) -> None:
    s = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, s)
    res = await session.execute(
        select(SeminarScheduleItem).where(
            SeminarScheduleItem.id == item_id, SeminarScheduleItem.seminar_id == seminar_id
        )
    )
    item = res.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    await session.delete(item)
    await session.commit()


async def _seats_filled(session: AsyncSession, seminar_id: int) -> int:
    res = await session.execute(
        select(func.count(SeminarRegistration.id)).where(
            SeminarRegistration.seminar_id == seminar_id,
            SeminarRegistration.status == "active",
        )
    )
    return int(res.scalar() or 0)


async def resolve_active_lot(session: AsyncSession, seminar_id: int, now: datetime) -> SeminarLot | None:
    # Preferência: lote cuja janela contém agora, pegando o maior `order`.
    active_stmt = (
        select(SeminarLot)
        .where(SeminarLot.seminar_id == seminar_id)
        .where(or_(SeminarLot.starts_at.is_(None), SeminarLot.starts_at <= now))
        .where(or_(SeminarLot.ends_at.is_(None), SeminarLot.ends_at > now))
        .order_by(
            SeminarLot.order.desc(),
            SeminarLot.starts_at.desc().nulls_last(),
            SeminarLot.id.desc(),
        )
        .limit(1)
    )
    res = await session.execute(active_stmt)
    lot = res.scalar_one_or_none()
    if lot:
        return lot

    # Fallback: próximo lote futuro (menor starts_at), ou o primeiro por order.
    future_stmt = (
        select(SeminarLot)
        .where(SeminarLot.seminar_id == seminar_id)
        .where(SeminarLot.starts_at.is_not(None))
        .where(SeminarLot.starts_at > now)
        .order_by(SeminarLot.starts_at.asc(), SeminarLot.order.asc(), SeminarLot.id.asc())
        .limit(1)
    )
    res2 = await session.execute(future_stmt)
    return res2.scalar_one_or_none()


async def next_lot_start(session: AsyncSession, seminar_id: int, now: datetime) -> datetime | None:
    res = await session.execute(
        select(func.min(SeminarLot.starts_at)).where(
            SeminarLot.seminar_id == seminar_id,
            SeminarLot.starts_at.is_not(None),
            SeminarLot.starts_at > now,
        )
    )
    return res.scalar_one_or_none()


async def pricing(session: AsyncSession, seminar: Seminar) -> dict:
    now = datetime.now(UTC)
    lot = await resolve_active_lot(session, seminar.id, now)
    filled = await _seats_filled(session, seminar.id)
    total = seminar.capacity
    percent = 0
    if total and total > 0:
        percent = int(round((filled / total) * 100))
        percent = max(0, min(100, percent))
    next_start = await next_lot_start(session, seminar.id, now)
    current_price = float(lot.price_amount) if lot else 0.0
    return {
        "seminar_id": seminar.id,
        "lot": lot,
        "current_price_amount": current_price,
        "seats_total": total,
        "seats_filled": filled,
        "percent_filled": percent,
        "next_lot_starts_at": next_start,
    }


async def get_public_summary(session: AsyncSession, seminar_id: int) -> dict:
    seminar = await get_seminar(session, seminar_id)
    if not seminar.is_published:
        raise HTTPException(status_code=403, detail="Seminário não publicado")
    if getattr(seminar, "visibility", "internal") != "public":
        raise HTTPException(status_code=404, detail="Seminário não encontrado")
    pr = await pricing(session, seminar)
    return {"seminar": seminar, "pricing": pr}


async def create_public_guest_registration(session: AsyncSession, seminar_id: int, payload) -> SeminarRegistration:
    seminar = await get_seminar(session, seminar_id)
    if not seminar.is_published:
        raise HTTPException(status_code=403, detail="Seminário não publicado")
    if getattr(seminar, "visibility", "internal") != "public":
        raise HTTPException(status_code=404, detail="Seminário não encontrado")

    # Capacidade.
    if seminar.capacity is not None:
        filled = await _seats_filled(session, seminar_id)
        if filled >= seminar.capacity:
            raise HTTPException(status_code=409, detail="Sem vagas disponíveis")

    if not (payload.guest_full_name and payload.guest_email):
        raise HTTPException(status_code=400, detail="Convidado precisa de nome e e-mail")

    pr = await pricing(session, seminar)
    price_amount = float(pr["current_price_amount"] or 0.0)
    if price_amount <= 0:
        pay_status = "confirmed"
        confirmed_at = datetime.now(UTC)
    else:
        pay_status = "pending_payment"
        confirmed_at = None

    reg = SeminarRegistration(
        seminar_id=seminar_id,
        buyer_user_id=None,
        student_id=None,
        guest_full_name=payload.guest_full_name,
        guest_email=str(payload.guest_email),
        guest_phone=payload.guest_phone,
        payment_status=pay_status,
        payment_confirmed_at=confirmed_at,
        paid_amount=price_amount if price_amount > 0 else None,
    )
    session.add(reg)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Inscrição duplicada")
    await session.refresh(reg)
    return reg


async def attach_payment_receipt_by_public_code(session: AsyncSession, public_code: str, file: UploadFile) -> SeminarRegistration:
    code = (public_code or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Código inválido")

    res = await session.execute(select(SeminarRegistration).where(SeminarRegistration.public_code == code))
    reg = res.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    seminar = await get_seminar(session, reg.seminar_id)
    if not seminar.is_published:
        raise HTTPException(status_code=403, detail="Seminário não publicado")
    if getattr(seminar, "visibility", "internal") != "public":
        raise HTTPException(status_code=404, detail="Seminário não encontrado")

    if reg.payment_status not in {"pending_payment", "rejected"}:
        raise HTTPException(status_code=409, detail="Pagamento já em análise/confirmado")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".pdf", ".webp"}:
        raise HTTPException(status_code=400, detail="Formato inválido (jpg/png/pdf/webp)")

    static_dir = Path(__file__).resolve().parents[4] / "static" / "receipts" / "seminars"
    static_dir.mkdir(parents=True, exist_ok=True)
    filename = f"seminar_{reg.seminar_id}_reg_{reg.id}{ext}"
    dest_path = static_dir / filename
    dest_path.write_bytes(await file.read())

    reg.payment_receipt_path = f"/static/receipts/seminars/{filename}"
    reg.payment_status = "pending_confirmation"
    reg.payment_notes = None
    await session.commit()
    await session.refresh(reg)
    return reg


async def create_registration(session: AsyncSession, user: User, seminar_id: int, payload) -> SeminarRegistration:
    seminar = await get_seminar(session, seminar_id)
    if user.role != "aluno":
        raise HTTPException(status_code=403, detail="Apenas alunos podem se inscrever")
    if not seminar.is_published:
        raise HTTPException(status_code=403, detail="Seminário não publicado")
    if getattr(seminar, "visibility", "internal") == "internal":
        if user.dojo_id and seminar.organizer_dojo_id != user.dojo_id:
            raise HTTPException(status_code=403, detail="Seminário não disponível para seu dojo")
        if not user.dojo_id:
            raise HTTPException(status_code=403, detail="Seminário não disponível para seu dojo")

    # Validação: aluno OU convidado.
    is_student = payload.student_id is not None
    is_guest = payload.guest_full_name or payload.guest_email or payload.guest_phone
    if is_student and is_guest:
        raise HTTPException(status_code=400, detail="Envie student_id OU dados do convidado")
    if not is_student and not is_guest:
        raise HTTPException(status_code=400, detail="Informe student_id ou dados do convidado")
    if is_guest and not (payload.guest_full_name and payload.guest_email):
        raise HTTPException(status_code=400, detail="Convidado precisa de nome e e-mail")

    # Capacidade.
    if seminar.capacity is not None:
        filled = await _seats_filled(session, seminar_id)
        if filled >= seminar.capacity:
            raise HTTPException(status_code=409, detail="Sem vagas disponíveis")

    pr = await pricing(session, seminar)
    price_amount = float(pr["current_price_amount"] or 0.0)
    if price_amount <= 0:
        pay_status = "confirmed"
        confirmed_at = datetime.now(UTC)
    else:
        pay_status = "pending_payment"
        confirmed_at = None

    reg = SeminarRegistration(
        seminar_id=seminar_id,
        buyer_user_id=user.id,
        student_id=payload.student_id if is_student else None,
        guest_full_name=payload.guest_full_name if not is_student else None,
        guest_email=str(payload.guest_email) if (not is_student and payload.guest_email) else None,
        guest_phone=payload.guest_phone if not is_student else None,
        payment_status=pay_status,
        payment_confirmed_at=confirmed_at,
        paid_amount=price_amount if price_amount > 0 else None,
    )
    session.add(reg)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        # Mensagem amigável para duplicidade.
        raise HTTPException(status_code=409, detail="Inscrição duplicada")
    await session.refresh(reg)
    return reg


async def list_my_registrations(session: AsyncSession, user: User, seminar_id: int) -> list[SeminarRegistration]:
    stmt = select(SeminarRegistration).where(
        SeminarRegistration.seminar_id == seminar_id,
        SeminarRegistration.buyer_user_id == user.id,
    ).order_by(desc(SeminarRegistration.created_at))
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def list_registrations_admin(
    session: AsyncSession, admin: User, seminar_id: int, payment_status: str | None = None
) -> list[SeminarRegistration]:
    seminar = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, seminar)
    stmt = select(SeminarRegistration).where(SeminarRegistration.seminar_id == seminar_id)
    if payment_status:
        stmt = stmt.where(SeminarRegistration.payment_status == payment_status)
    stmt = stmt.order_by(desc(SeminarRegistration.created_at))
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def attach_payment_receipt(
    session: AsyncSession, user: User, seminar_id: int, registration_id: int, file: UploadFile
) -> SeminarRegistration:
    res = await session.execute(
        select(SeminarRegistration).where(
            SeminarRegistration.id == registration_id,
            SeminarRegistration.seminar_id == seminar_id,
            SeminarRegistration.buyer_user_id == user.id,
        )
    )
    reg = res.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    if reg.payment_status not in {"pending_payment", "rejected"}:
        raise HTTPException(status_code=409, detail="Pagamento já em análise/confirmado")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".pdf", ".webp"}:
        raise HTTPException(status_code=400, detail="Formato inválido (jpg/png/pdf/webp)")

    static_dir = Path(__file__).resolve().parents[4] / "static" / "receipts" / "seminars"
    static_dir.mkdir(parents=True, exist_ok=True)
    filename = f"seminar_{seminar_id}_reg_{registration_id}{ext}"
    dest_path = static_dir / filename
    dest_path.write_bytes(await file.read())

    reg.payment_receipt_path = f"/static/receipts/seminars/{filename}"
    reg.payment_status = "pending_confirmation"
    reg.payment_notes = None
    await session.commit()
    await session.refresh(reg)
    return reg


async def confirm_payment(
    session: AsyncSession, admin: User, seminar_id: int, registration_id: int
) -> SeminarRegistration:
    seminar = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, seminar)
    res = await session.execute(
        select(SeminarRegistration).where(
            SeminarRegistration.id == registration_id,
            SeminarRegistration.seminar_id == seminar_id,
        )
    )
    reg = res.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    if reg.payment_status == "confirmed":
        return reg
    if reg.payment_status not in {"pending_confirmation", "pending_payment", "rejected"}:
        raise HTTPException(status_code=409, detail="Status inválido")

    reg.payment_status = "confirmed"
    reg.payment_confirmed_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(reg)
    return reg


async def reject_payment(
    session: AsyncSession, admin: User, seminar_id: int, registration_id: int, notes: str | None
) -> SeminarRegistration:
    seminar = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, seminar)
    res = await session.execute(
        select(SeminarRegistration).where(
            SeminarRegistration.id == registration_id,
            SeminarRegistration.seminar_id == seminar_id,
        )
    )
    reg = res.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    if reg.payment_status == "confirmed":
        raise HTTPException(status_code=409, detail="Pagamento já confirmado")
    reg.payment_status = "rejected"
    reg.payment_notes = (notes or "").strip() or None
    await session.commit()
    await session.refresh(reg)
    return reg


def create_ticket_token(registration_id: int, seminar_id: int, public_code: str) -> tuple[str, datetime]:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(hours=12)
    payload = {
        "rid": registration_id,
        "sid": seminar_id,
        "code": public_code,
        "type": "seminar_ticket",
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


def decode_ticket_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except Exception:
        raise HTTPException(status_code=401, detail="Ticket inválido")
    if payload.get("type") != "seminar_ticket":
        raise HTTPException(status_code=401, detail="Ticket inválido")
    return payload


async def get_ticket(session: AsyncSession, user: User, seminar_id: int, registration_id: int) -> tuple[SeminarRegistration, str, datetime]:
    res = await session.execute(
        select(SeminarRegistration).where(
            SeminarRegistration.id == registration_id,
            SeminarRegistration.seminar_id == seminar_id,
            SeminarRegistration.buyer_user_id == user.id,
        )
    )
    reg = res.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    if reg.payment_status != "confirmed":
        raise HTTPException(status_code=403, detail="Pagamento não confirmado")
    token, exp = create_ticket_token(reg.id, seminar_id, reg.public_code)
    return reg, token, exp


async def check_in(
    session: AsyncSession, admin: User, seminar_id: int, token: str | None, public_code: str | None
) -> SeminarAttendance:
    seminar = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, seminar)

    reg: SeminarRegistration | None = None
    if token:
        payload = decode_ticket_token(token)
        if int(payload.get("sid")) != seminar_id:
            raise HTTPException(status_code=401, detail="Ticket inválido")
        rid = int(payload.get("rid"))
        res = await session.execute(
            select(SeminarRegistration).where(
                SeminarRegistration.id == rid,
                SeminarRegistration.seminar_id == seminar_id,
            )
        )
        reg = res.scalar_one_or_none()
    elif public_code:
        res = await session.execute(
            select(SeminarRegistration).where(
                SeminarRegistration.seminar_id == seminar_id,
                SeminarRegistration.public_code == public_code.strip(),
            )
        )
        reg = res.scalar_one_or_none()
    else:
        raise HTTPException(status_code=400, detail="Informe token ou código")

    if reg is None:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")
    if reg.payment_status != "confirmed":
        raise HTTPException(status_code=403, detail="Pagamento não confirmado")

    # Idempotente: se já existe, retorna.
    existing = await session.execute(
        select(SeminarAttendance).where(SeminarAttendance.registration_id == reg.id)
    )
    att = existing.scalar_one_or_none()
    if att:
        return att

    att = SeminarAttendance(
        seminar_id=seminar_id,
        registration_id=reg.id,
        checked_in_by_user_id=admin.id,
    )
    session.add(att)
    await session.commit()
    await session.refresh(att)
    return att


async def list_attendance(session: AsyncSession, admin: User, seminar_id: int) -> list[SeminarAttendance]:
    seminar = await get_seminar(session, seminar_id)
    _assert_admin_can_access(admin, seminar)
    res = await session.execute(
        select(SeminarAttendance)
        .where(SeminarAttendance.seminar_id == seminar_id)
        .order_by(desc(SeminarAttendance.checked_in_at))
    )
    return list(res.scalars().all())


async def push_to_dojo_users(session: AsyncSession, dojo_id: int, title: str, body: str, payload: dict | None = None) -> int:
    # MVP: push direto usando o sender existente; sem outbox específica.
    # Retorna quantos envios tentamos (com token presente).
    res = await session.execute(select(User).where(User.dojo_id == dojo_id, User.is_active.is_(True)))
    users = list(res.scalars().all())
    attempted = 0
    payload_json = json.dumps(payload or {}, ensure_ascii=False) if payload else None
    # Import lazy para não quebrar ambientes sem google-auth instalado.
    try:
        from app.modules.competitions.fcm import send_fcm_notification_if_configured  # type: ignore
    except Exception:
        send_fcm_notification_if_configured = None  # type: ignore
    for u in users:
        if not u.fcm_token:
            continue
        attempted += 1
        if send_fcm_notification_if_configured:
            send_fcm_notification_if_configured(u.fcm_token, title, body)
        # Sem persistência no MVP; competições têm NotificationOutbox, mas seminário não precisa.
        _ = payload_json
    return attempted

