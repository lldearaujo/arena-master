from __future__ import annotations

from datetime import date
import json
import logging
from typing import Any, Iterable

import httpx

from sqlalchemy import Select, and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.competition import Competition, CompetitionAward, CompetitionPrize
from app.models.dojo_modalidade import DojoModalidade
from app.models.faixa import Faixa
from app.models.finance import Plan
from app.models.student import Student
from app.models.student_guardian import StudentGuardian
from app.models.turma import Turma
from app.models.turma_enrollment import TurmaEnrollment
from app.models.user import User
from app.models.dojo import Dojo
from app.core.security import get_password_hash
from app.modules.students.schemas import (
    GuardianLink,
    GuardianRead,
    StudentCreate,
    StudentRead,
    StudentSelfUpdate,
    StudentUpdate,
)

logger = logging.getLogger(__name__)

_MAX_ACADEMIC_ITEMS = 50
_MAX_ACADEMIC_ITEM_LEN = 500


def parse_academic_list(raw: str | None) -> list[str]:
    if not raw or not str(raw).strip():
        return []
    try:
        data = json.loads(raw)
        if not isinstance(data, list):
            return []
        out: list[str] = []
        for x in data:
            s = str(x).strip()[:_MAX_ACADEMIC_ITEM_LEN]
            if s:
                out.append(s)
            if len(out) >= _MAX_ACADEMIC_ITEMS:
                break
        return out
    except (json.JSONDecodeError, TypeError, ValueError):
        return []


def dump_academic_list(items: list[str]) -> str:
    cleaned: list[str] = []
    for x in items:
        s = str(x).strip()[:_MAX_ACADEMIC_ITEM_LEN]
        if s:
            cleaned.append(s)
        if len(cleaned) >= _MAX_ACADEMIC_ITEMS:
            break
    return json.dumps(cleaned, ensure_ascii=False)


async def assert_faixa_grau_for_modalidade(
    session: AsyncSession,
    dojo_id: int,
    faixa_id: int | None,
    modalidade: str | None,
    grau: int | None,
) -> None:
    """Garante que faixa pertence ao dojo, à modalidade informada e grau está no limite."""
    if faixa_id is None:
        return
    faixa = await session.get(Faixa, faixa_id)
    if faixa is None or faixa.dojo_id != dojo_id:
        raise ValueError("Faixa inválida")
    dm = await session.get(DojoModalidade, faixa.modalidade_id)
    if dm is None or dm.dojo_id != dojo_id:
        raise ValueError("Faixa inválida")
    part = (modalidade or "").split(",")[0].strip()
    if not part:
        raise ValueError("Informe a modalidade para usar graduação")
    if dm.name.strip().casefold() != part.casefold():
        raise ValueError("A faixa selecionada não pertence à modalidade informada")
    g = int(grau if grau is not None else 0)
    if g < 0 or g > int(faixa.max_graus):
        raise ValueError("Grau ou dan fora do limite da faixa selecionada")


def default_password_for_student_id(student_id: int) -> str:
    """Senha padrão de acesso ao app (mesma regra de create_student)."""
    return f"aluno{student_id:04d}"


def _students_query(dojo_id: int) -> Select[tuple[Student]]:
    return select(Student).where(Student.dojo_id == dojo_id).order_by(Student.id)


async def list_students(session: AsyncSession, dojo_id: int) -> list[Student]:
    result = await session.execute(_students_query(dojo_id))
    return list(result.scalars().all())


async def get_student(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
) -> Student | None:
    result = await session.execute(
        _students_query(dojo_id).where(Student.id == student_id)
    )
    return result.scalar_one_or_none()


async def create_student(
    session: AsyncSession,
    dojo_id: int,
    data: StudentCreate,
) -> tuple[Student, str, str]:
    await assert_faixa_grau_for_modalidade(
        session, dojo_id, data.faixa_id, data.modalidade, data.grau
    )
    # Primeiro criamos o registro do aluno
    student = Student(
        dojo_id=dojo_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        birth_date=data.birth_date,
        modalidade=data.modalidade,
        notes=data.notes,
        faixa_id=data.faixa_id,
        grau=data.grau,
    )
    session.add(student)
    # Garante que o ID do aluno seja gerado
    await session.flush()

    # Busca o dojo para compor o login
    dojo = await session.get(Dojo, dojo_id)
    dojo_name = dojo.name if dojo is not None else f"dojo{dojo_id}"

    # Regra de padronização de credenciais do aluno:
    # - e-mail de login: "{nome_do_aluno}@{nome_do_dojo}" (sem espaços, em minúsculas)
    # - senha padrão: aluno{student_id:04d}
    student_slug = student.name.strip().lower().replace(" ", "")
    dojo_slug = dojo_name.strip().lower().replace(" ", "")
    login_email = f"{student_slug}@{dojo_slug}"
    initial_password = f"aluno{student.id:04d}"
    password_hash = get_password_hash(initial_password)

    user = User(
        email=login_email,
        password_hash=password_hash,
        role="aluno",
        dojo_id=dojo_id,
        name=student.name,
        is_active=bool(data.is_active),
    )
    session.add(user)
    await session.flush()

    # Vincula o usuário recém-criado ao aluno
    student.user_id = user.id

    # Garante que todo aluno tenha um plano associado (se já existir plano ativo compatível com a modalidade).
    # A assinatura começa como pendente de pagamento e libera créditos apenas após confirmação do professor.
    from app.modules.finance import service as finance_service

    default_plan_id = await finance_service.first_matching_active_plan_id(
        session, dojo_id, data.modalidade
    )
    if default_plan_id is not None:
        from app.modules.finance import schemas as finance_schemas

        try:
            await finance_service.create_student_subscription(
                session,
                dojo_id,
                student.id,
                finance_schemas.StudentSubscriptionCreate(plan_id=default_plan_id),
            )
        except Exception:
            # Não impede criação do aluno se algo financeiro falhar
            pass

    await session.commit()
    await session.refresh(student)
    return student, initial_password, login_email


async def reset_student_password_to_default(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
) -> tuple[str, str] | None:
    """
    Redefine a senha do usuário vinculado ao aluno para o padrão do sistema.
    Retorna (senha_em_texto_plano, email_de_login) ou None se aluno/usuário inválido.
    """
    student = await get_student(session, dojo_id, student_id)
    if student is None or student.user_id is None:
        return None

    result = await session.execute(select(User).where(User.id == student.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return None

    plain = default_password_for_student_id(student.id)
    user.password_hash = get_password_hash(plain)
    await session.commit()
    await session.refresh(user)
    return plain, user.email


async def update_student(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    data: StudentUpdate,
) -> Student | None:
    student = await get_student(session, dojo_id, student_id)
    if student is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    is_active = update_data.pop("is_active", None)
    acad_master = update_data.pop("academic_mastered_techniques", None)
    acad_obj = update_data.pop("academic_next_objectives", None)

    # Valida faixa/grau APENAS se o payload está alterando algo desse trio.
    # Isso evita bloquear updates "parciais" (ex.: progresso acadêmico) quando o aluno
    # já possui dados históricos inconsistentes (faixa vs modalidade).
    if any(k in update_data for k in ("modalidade", "faixa_id", "grau")):
        next_modalidade = (
            update_data["modalidade"]
            if "modalidade" in update_data
            else student.modalidade
        )
        next_faixa = (
            update_data["faixa_id"] if "faixa_id" in update_data else student.faixa_id
        )
        next_grau = update_data["grau"] if "grau" in update_data else student.grau
        await assert_faixa_grau_for_modalidade(
            session, dojo_id, next_faixa, next_modalidade, next_grau
        )

    if acad_master is not None:
        student.academic_mastered_techniques = dump_academic_list(acad_master)
    if acad_obj is not None:
        student.academic_next_objectives = dump_academic_list(acad_obj)

    for field, value in update_data.items():
        setattr(student, field, value)

    # Atualiza o status do usuário vinculado (login do aluno), se existir
    if is_active is not None and student.user_id is not None:
        result = await session.execute(select(User).where(User.id == student.user_id))
        user = result.scalar_one_or_none()
        if user is not None:
            user.is_active = bool(is_active)

    await session.commit()
    await session.refresh(student)
    return student


async def delete_student(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
) -> bool:
    student = await get_student(session, dojo_id, student_id)
    if student is None:
        return False

    # Remove também o usuário vinculado, se existir
    if student.user_id is not None:
        result = await session.execute(
            select(User).where(User.id == student.user_id)
        )
        user = result.scalar_one_or_none()
        if user is not None:
            await session.delete(user)

    await session.delete(student)
    await session.commit()
    return True


async def list_guardians(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
) -> list[StudentGuardian]:
    result = await session.execute(
        select(StudentGuardian).where(
            and_(
                StudentGuardian.dojo_id == dojo_id,
                StudentGuardian.student_id == student_id,
            )
        )
    )
    return list(result.scalars().all())


async def add_guardian(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    data: GuardianLink,
) -> StudentGuardian:
    # garante que o aluno pertence ao dojo
    student = await get_student(session, dojo_id, student_id)
    if student is None:
        raise ValueError("Aluno não encontrado")

    # garante que o usuário existe e pertence ao mesmo dojo (ou é superadmin, se for o caso futuro)
    result = await session.execute(
        select(User).where(
            and_(
                User.id == data.user_id,
                User.dojo_id == dojo_id,
            )
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise ValueError("Usuário responsável inválido para este dojo")

    # evita duplicidade
    existing = await session.execute(
        select(StudentGuardian).where(
            and_(
                StudentGuardian.dojo_id == dojo_id,
                StudentGuardian.student_id == student_id,
                StudentGuardian.user_id == data.user_id,
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("Responsável já vinculado a este aluno")

    guardian = StudentGuardian(
        dojo_id=dojo_id,
        user_id=data.user_id,
        student_id=student_id,
    )
    session.add(guardian)
    await session.commit()
    await session.refresh(guardian)
    return guardian


async def remove_guardian(
    session: AsyncSession,
    dojo_id: int,
    student_id: int,
    user_id: int,
) -> bool:
    result = await session.execute(
        select(StudentGuardian).where(
            and_(
                StudentGuardian.dojo_id == dojo_id,
                StudentGuardian.student_id == student_id,
                StudentGuardian.user_id == user_id,
            )
        )
    )
    guardian = result.scalar_one_or_none()
    if guardian is None:
        return False

    await session.delete(guardian)
    await session.commit()
    return True


async def allowed_modalidades_for_student_turmas(
    session: AsyncSession,
    student: Student,
) -> list[str] | None:
    """Modalidades para filtrar turmas no app. None = sem filtro (todas do dia no dojo).

    Usa `students.modalidade` ou, se vazio, as modalidades restritas do plano da assinatura
    (ativa ou pendente de pagamento).
    """
    direct = (student.modalidade or "").strip()
    if direct:
        return [direct]
    if student.dojo_id is None:
        return None
    from app.modules.finance import service as finance_service

    sub = await finance_service.get_subscription_for_modalidade_resolution(
        session, student.dojo_id, student.id
    )
    if sub is None:
        return None
    plan = await session.get(Plan, sub.plan_id)
    if plan is None:
        return None
    targets = finance_service.plan_restricted_modalidades(plan)
    if not targets:
        return None
    return targets


async def _modalidade_from_active_turmas(
    session: AsyncSession,
    student_id: int,
) -> str | None:
    """Modalidades distintas das turmas em que o aluno está matriculado (ativo)."""
    result = await session.execute(
        select(Turma.modalidade)
        .join(TurmaEnrollment, TurmaEnrollment.turma_id == Turma.id)
        .where(
            and_(
                TurmaEnrollment.student_id == student_id,
                TurmaEnrollment.active.is_(True),
                Turma.active.is_(True),
                Turma.modalidade.is_not(None),
            )
        )
    )
    raw = [row[0] for row in result.all() if row[0] is not None]
    seen_cf: set[str] = set()
    ordered: list[str] = []
    for m in raw:
        label = str(m).strip()
        if not label:
            continue
        k = label.casefold()
        if k in seen_cf:
            continue
        seen_cf.add(k)
        ordered.append(label)
    if not ordered:
        return None
    if len(ordered) == 1:
        return ordered[0]
    return ", ".join(ordered)


async def display_modalidade_for_student(
    session: AsyncSession,
    student: Student,
) -> str | None:
    """Texto de modalidade para perfil / API (cadastro, plano ou turmas matriculadas)."""
    direct = (student.modalidade or "").strip()
    if direct:
        return direct
    allowed = await allowed_modalidades_for_student_turmas(session, student)
    if allowed:
        if len(allowed) == 1:
            return allowed[0]
        return ", ".join(allowed)
    return await _modalidade_from_active_turmas(session, student.id)


async def exibir_graduacao_no_perfil(
    session: AsyncSession,
    student: Student,
    modalidade_display: str | None,
) -> bool:
    """False quando todas as modalidades exibidas existem no catálogo e nenhuma usa graduação."""
    dojo_id = student.dojo_id
    if dojo_id is None:
        return True
    text = (modalidade_display or "").strip()
    if not text:
        return True
    from app.modules.modalidades import service as modalidades_service

    parts = [p.strip() for p in text.split(",") if p.strip()]
    if not parts:
        return True
    any_unknown = False
    any_has_grad = False
    for part in parts:
        row = await modalidades_service.get_modalidade_by_name_casefold(
            session, dojo_id, part
        )
        if row is None:
            any_unknown = True
        elif row.has_graduation_system:
            any_has_grad = True
    if any_unknown or any_has_grad:
        return True
    return False


async def get_student_for_user(
    session: AsyncSession,
    user: User,
) -> Student | None:
    if user.role != "aluno":
        return None
    # 1) Vínculo direto (inclui atletas só de inscrição pública, sem dojo_id no User)
    result = await session.execute(select(Student).where(Student.user_id == user.id))
    student = result.scalar_one_or_none()
    if student is not None:
        return student
    if user.dojo_id is None:
        return None
    # 2) Fallback: busca por email no mesmo dojo
    result = await session.execute(
        select(Student).where(
            and_(
                Student.dojo_id == user.dojo_id,
                Student.email == user.email,
            )
        )
    )
    student = result.scalar_one_or_none()
    if student is not None:
        return student
    # 3) Fallback: login padrão é "nomestudante@nomdojo" - encontra aluno pelo padrão
    dojo = await session.get(Dojo, user.dojo_id)
    dojo_slug = (dojo.name.strip().lower().replace(" ", "") if dojo else "") or str(user.dojo_id)
    if "@" not in user.email:
        return None
    result = await session.execute(
        select(Student).where(
            and_(
                Student.dojo_id == user.dojo_id,
                Student.user_id.is_(None),
            )
        )
    )
    for s in result.scalars().all():
        slug = s.name.strip().lower().replace(" ", "")
        if f"{slug}@{dojo_slug}" == user.email.lower():
            return s
    return None


async def list_my_competition_awards(
    session: AsyncSession,
    user: User,
) -> list[dict]:
    """
    Retorna as medalhas/pódios do aluno logado.
    Estrutura em dict para evitar dependência cruzada de schemas entre módulos.
    """
    student = await get_student_for_user(session, user)
    if student is None:
        return []

    r = await session.execute(
        select(
            CompetitionAward,
            Competition.name,
            Competition.reference_year,
            CompetitionPrize.reward,
        )
        .join(Competition, Competition.id == CompetitionAward.competition_id)
        .outerjoin(CompetitionPrize, CompetitionPrize.id == CompetitionAward.prize_id)
        .where(CompetitionAward.student_id == student.id)
        .order_by(CompetitionAward.awarded_at.desc(), CompetitionAward.id.desc())
    )

    out: list[dict] = []
    for award, comp_name, ref_year, reward in r.all():
        out.append(
            {
                "id": award.id,
                "competition_id": award.competition_id,
                "kind": award.kind,
                "age_division_id": award.age_division_id,
                "weight_class_id": award.weight_class_id,
                "gender": award.gender,
                "modality": award.modality,
                "place": int(award.place),
                "awarded_at": award.awarded_at.isoformat() if award.awarded_at else None,
                "reward": reward,
                "competition_name": comp_name,
                "reference_year": int(ref_year) if ref_year is not None else None,
            }
        )
    return out


async def update_student_self(
    session: AsyncSession,
    student: Student,
    payload: "schemas.StudentSelfUpdate",
) -> Student:
    """
    Update limitado para o próprio aluno.
    Somente campos pessoais que não afetam regras de graduação/matrícula.
    """
    data = payload.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise ValueError("Informe seu nome.")
        student.name = name
    if "birth_date" in data:
        student.birth_date = data["birth_date"]
    if "weight_kg" in data:
        w = data["weight_kg"]
        student.weight_kg = float(w) if w is not None else None
    await session.commit()
    await session.refresh(student)
    return student


def _extract_bushido_text(payload: Any) -> str | None:
    """
    Aceita respostas variadas do n8n:
    - JSON com campos comuns (text, ensinamento, message, result, data.text)
    - string direta (caso webhook retorne texto puro)
    """
    if payload is None:
        return None
    if isinstance(payload, str):
        text = payload.strip()
        return text or None
    if isinstance(payload, bytes):
        try:
            text = payload.decode("utf-8", errors="ignore").strip()
        except Exception:
            return None
        return text or None
    if isinstance(payload, dict):
        for key in ("text", "ensinamento", "mensagem", "message", "result", "output"):
            v = payload.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
        data = payload.get("data")
        if isinstance(data, dict):
            v = data.get("text") or data.get("ensinamento") or data.get("message")
            if isinstance(v, str) and v.strip():
                return v.strip()
    return None


def _normalize_master_note(text: str) -> str:
    """
    Normaliza texto vindo do n8n para exibição no app (sem markdown "cru").

    Casos reais que tratamos:
    - Webhook respondendo "Text" com body como:
      { {{ $json.output }} }
      -> o app recebe algo começando com "{" e terminando com "}".
    - O conteúdo pode vir em Markdown simples (ex.: **negrito**).
    """
    t = (text or "").strip()
    if not t:
        return ""

    # Se veio com "\n" literal, converte.
    t = t.replace("\\r\\n", "\n").replace("\\n", "\n").replace("\\r", "\n")

    # Remove wrapper `{ ... }` quando for apenas "embrulho" (sem parecer JSON de verdade).
    if t.startswith("{") and t.endswith("}"):
        inner = t[1:-1].strip()
        # Se não tem ":" (parece não ser objeto JSON), trata como wrapper.
        if ":" not in inner:
            t = inner

    # Remove negrito/ênfases comuns de markdown.
    t = t.replace("**", "").replace("__", "").replace("`", "")

    # Colapsa espaços excessivos (preserva quebras de linha).
    lines = [ln.strip() for ln in t.splitlines()]
    t = "\n".join([ln for ln in lines if ln != ""])

    return t.strip()


async def refresh_master_notes_if_needed(
    *,
    session: AsyncSession,
    student: Student,
    user: User,
    today: date,
    webhook_url: str,
    webhook_method: str = "POST",
) -> None:
    """
    Gera 1 ensinamento por dia e por usuário, persiste em students.master_notes(+date).
    Best-effort: se falhar, mantém o conteúdo anterior e não levanta exceção.
    """
    # Se já foi marcado hoje mas não há texto, tentamos novamente.
    if student.master_notes_date == today and (student.master_notes or "").strip():
        return
    if not webhook_url:
        return
    webhook_url = str(webhook_url).strip()
    # Protege contra URL inválida (ex.: "https://.n8n....")
    if webhook_url.startswith("https://.") or webhook_url.startswith("http://."):
        logger.error("BUSHIDO webhook URL inválida: %s", webhook_url)
        return

    body = {
        "user_id": user.id,
        "student_id": student.id,
        "dojo_id": user.dojo_id,
        "date": today.isoformat(),
    }

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            method = (webhook_method or "POST").strip().upper()
            headers = {"Accept": "application/json, text/plain;q=0.9, */*;q=0.8"}

            async def _do_post():
                return await client.post(webhook_url, json=body, headers=headers)

            async def _do_get():
                # GET com query params (compatível com webhook que foi testado no browser)
                return await client.get(webhook_url, params=body, headers=headers)

            if method == "GET":
                res = await _do_get()
                # Se GET falhar por método, tenta POST
                if res.status_code in (405, 404):
                    res = await _do_post()
            else:
                res = await _do_post()
                # Se POST não for aceito, tenta GET
                if res.status_code == 405:
                    res = await _do_get()

            if res.status_code >= 400:
                logger.error(
                    "Webhook Bushido respondeu %s (method=%s url=%s body=%s): %s",
                    res.status_code,
                    method,
                    webhook_url,
                    body,
                    (res.text or "")[:400],
                )
                res.raise_for_status()
            content_type = (res.headers.get("content-type") or "").lower()
            if "application/json" in content_type:
                data = res.json()
                text = _extract_bushido_text(data) or _extract_bushido_text(res.text)
            else:
                text = _extract_bushido_text(res.text)
    except Exception as exc:
        logger.exception(
            "Falha ao consultar webhook Bushido (url=%s, user_id=%s, student_id=%s): %s",
            webhook_url,
            getattr(user, "id", None),
            getattr(student, "id", None),
            exc,
        )
        return

    if not text:
        return

    cleaned = _normalize_master_note(text)
    if not cleaned:
        return

    student.master_notes = cleaned
    student.master_notes_date = today
    await session.commit()
    await session.refresh(student)


def _format_graduacao(faixa: Faixa | None, grau: int) -> str | None:
    if faixa is None:
        return None
    if grau <= 0:
        return f"Faixa {faixa.name}"
    if faixa.exibir_como_dan:
        return f"Faixa {faixa.name} {grau}º dan"
    return f"Faixa {faixa.name} {grau}º grau"


async def get_graduacao_display(
    session: AsyncSession,
    student: Student,
) -> str | None:
    if student.faixa_id is None:
        if student.external_faixa_label:
            return student.external_faixa_label.strip()
        return None
    result = await session.execute(
        select(Faixa).where(Faixa.id == student.faixa_id)
    )
    faixa = result.scalar_one_or_none()
    return _format_graduacao(faixa, student.grau)


def graduacao_display_with_faixa_map(
    student: Student,
    faixa_by_id: dict[int, Faixa],
) -> str | None:
    """Versão síncrona para listagens em massa (evita N+1 queries por aluno)."""
    if student.faixa_id is None:
        if student.external_faixa_label:
            return student.external_faixa_label.strip()
        return None
    faixa = faixa_by_id.get(student.faixa_id)
    return _format_graduacao(faixa, student.grau)

