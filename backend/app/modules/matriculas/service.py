from __future__ import annotations

import secrets

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.matricula_link import MatriculaLink
from app.modules.faixas.service import list_faixas_read
from app.models.student import Student
from app.models.student_guardian import StudentGuardian
from app.models.user import User
from app.models.finance import StudentSubscription, StudentSubscriptionStatus
from app.modules.finance import service as finance_service
from app.modules.matriculas import schemas
from app.modules.students import service as students_service
from app.modules.turmas import service as turmas_service


def _generate_token() -> str:
    # URL-safe sem caracteres problemáticos para enviar por WhatsApp.
    return secrets.token_urlsafe(32)


async def generate_link(session: AsyncSession, dojo_id: int) -> MatriculaLink:
    for _ in range(5):
        token = _generate_token()
        existing = await session.execute(select(MatriculaLink).where(MatriculaLink.token == token))
        if existing.scalar_one_or_none() is None:
            link = MatriculaLink(dojo_id=dojo_id, token=token, active=True)
            session.add(link)
            await session.commit()
            await session.refresh(link)
            return link
    # Se for raro uma colisão persistente, fallback com erro explícito.
    raise RuntimeError("Não foi possível gerar um token único para o link de matrícula")


async def get_active_link(session: AsyncSession, token: str) -> MatriculaLink | None:
    result = await session.execute(
        select(MatriculaLink).where(
            and_(
                MatriculaLink.token == token,
                MatriculaLink.active.is_(True),
            )
        )
    )
    return result.scalar_one_or_none()


async def get_public_form_data(
    session: AsyncSession,
    token: str,
) -> tuple[schemas.MatriculaDojoRead, list, list[str], list[schemas.FaixaOption]]:
    """
    Retorna dados para popular o form público:
    - dojo
    - planos ativos desse dojo
    """
    link = await get_active_link(session, token)
    if link is None:
        raise ValueError("Link de matrícula inválido")

    from app.models.dojo import Dojo

    dojo = await session.get(Dojo, link.dojo_id)
    if dojo is None or not dojo.active:
        raise ValueError("Academia não encontrada")

    dojo_read = schemas.MatriculaDojoRead(
        id=dojo.id,
        name=dojo.name,
        logo_url=dojo.logo_url,
        contato=dojo.contato,
        slug=dojo.slug,
    )
    plans = await finance_service.list_active_plans(session, dojo.id)
    # Mesma lista do painel: catálogo do dojo + modalidades já usadas em turmas/alunos.
    modalidades = await turmas_service.list_modalidades_for_dojo(session, dojo.id)

    # Faixas por modalidade (para popular o select de graduação).
    faixa_reads = await list_faixas_read(session, dojo.id)
    faixas = [
        schemas.FaixaOption(
            id=r.id,
            name=r.name,
            max_graus=r.max_graus,
            exibir_como_dan=bool(r.exibir_como_dan),
            modalidade_id=r.modalidade_id,
            modalidade_name=r.modalidade_name,
        )
        for r in faixa_reads
    ]

    return dojo_read, plans, modalidades, faixas


async def _ensure_guardian_for_kids(
    session: AsyncSession,
    dojo_id: int,
    user_id: int,
    kid_student_id: int,
) -> None:
    """
    No MVP, em turmas KIDS o usuário logado faz check-in sobre a criança.
    Criamos um vínculo StudentGuardian entre o usuário (responsável) e o student (criança).
    """
    existing = await session.execute(
        select(StudentGuardian).where(
            and_(
                StudentGuardian.dojo_id == dojo_id,
                StudentGuardian.user_id == user_id,
                StudentGuardian.student_id == kid_student_id,
            )
        )
    )
    if existing.scalar_one_or_none() is None:
        session.add(
            StudentGuardian(dojo_id=dojo_id, user_id=user_id, student_id=kid_student_id)
        )
        await session.commit()


async def submit_matricula(
    session: AsyncSession,
    token: str,
    payload: schemas.MatriculaSubmitRequest,
) -> schemas.MatriculaSubmitResponse:
    link = await get_active_link(session, token)
    if link is None:
        raise ValueError("Link de matrícula inválido")

    dojo_id = link.dojo_id

    # Valida e normaliza faixa/grau selecionados (faixa deve bater com a modalidade).
    selected_faixa_id = payload.student.faixa_id
    selected_grau = payload.student.grau if payload.student.grau is not None else 0
    if selected_faixa_id is not None:
        await students_service.assert_faixa_grau_for_modalidade(
            session,
            dojo_id,
            selected_faixa_id,
            payload.student.modalidade,
            selected_grau,
        )
    else:
        selected_grau = 0

    from app.modules.finance import service as finance_service

    await finance_service.assert_plan_allowed_for_modalidade(
        session,
        dojo_id,
        payload.plan_id,
        payload.student.modalidade,
    )

    # Verifica usuário existente (email é único no sistema).
    existing_user = await session.execute(
        select(User).where(User.email == payload.student.email)
    )
    user = existing_user.scalar_one_or_none()

    if user is not None:
        if user.role != "aluno":
            raise ValueError("E-mail já cadastrado como outro tipo de usuário")
        if user.dojo_id != dojo_id:
            raise ValueError("E-mail já cadastrado em outra academia")

        student = await students_service.get_student_for_user(session, user)
        if student is None:
            raise ValueError("Usuário já cadastrado, mas aluno não encontrado")

        # Atualiza campos do aluno relacionados à matrícula.
        student.faixa_id = selected_faixa_id
        student.grau = int(selected_grau)
        student.modalidade = payload.student.modalidade
        await session.commit()

        # Kids: garante vínculo de responsável para a criança.
        if payload.type == "kids":
            await _ensure_guardian_for_kids(
                session,
                dojo_id=dojo_id,
                user_id=user.id,
                kid_student_id=student.id,
            )

        # Se já existe assinatura pendente/ativa, não criamos novamente.
        existing_sub = await session.execute(
            select(StudentSubscription).where(
                and_(
                    StudentSubscription.dojo_id == dojo_id,
                    StudentSubscription.student_id == student.id,
                    StudentSubscription.status.in_(
                        [
                            StudentSubscriptionStatus.PENDING_PAYMENT,
                            StudentSubscriptionStatus.ACTIVE,
                        ]
                    ),
                )
            )
        )
        if existing_sub.scalar_one_or_none() is not None:
            return schemas.MatriculaSubmitResponse(
                status="existing",
                login_email=str(payload.student.email),
                message="Este e-mail já está cadastrado. Faça login para acessar o app.",
            )

        # Cria assinatura pendente para o plano escolhido.
        from app.modules.finance import schemas as finance_schemas
        from app.models.finance import StudentSubscriptionRecurrence

        finance_payload = finance_schemas.StudentSubscriptionCreate(
            plan_id=payload.plan_id,
            recurrence_type=StudentSubscriptionRecurrence.NONE,
        )
        await finance_service.create_student_subscription(
            session,
            dojo_id=dojo_id,
            student_id=student.id,
            data=finance_payload,
        )

        return schemas.MatriculaSubmitResponse(
            status="created",
            login_email=str(payload.student.email),
            message="Matrícula na academia confirmada e plano ativado como pendente.",
        )

    # Usuário não existe: cria User + Student.
    password_hash = get_password_hash(payload.student.password)

    user = User(
        email=str(payload.student.email),
        password_hash=password_hash,
        role="aluno",
        dojo_id=dojo_id,
        name=payload.student.name,
        is_active=True,
    )
    session.add(user)
    await session.flush()

    student = Student(
        dojo_id=dojo_id,
        name=payload.student.name,
        email=str(payload.student.email),
        phone=payload.student.phone,
        user_id=user.id,
        modalidade=payload.student.modalidade,
        faixa_id=selected_faixa_id,
        grau=int(selected_grau),
    )
    session.add(student)
    await session.commit()
    await session.refresh(student)
    await session.refresh(user)

    # Kids: cria vínculo de responsável para a criança.
    if payload.type == "kids":
        await _ensure_guardian_for_kids(
            session,
            dojo_id=dojo_id,
            user_id=user.id,
            kid_student_id=student.id,
        )

    # Cria assinatura pendente para o plano escolhido.
    from app.modules.finance import schemas as finance_schemas
    from app.models.finance import StudentSubscriptionRecurrence

    finance_payload = finance_schemas.StudentSubscriptionCreate(
        plan_id=payload.plan_id,
        recurrence_type=StudentSubscriptionRecurrence.NONE,
    )

    await finance_service.create_student_subscription(
        session,
        dojo_id=dojo_id,
        student_id=student.id,
        data=finance_payload,
    )

    return schemas.MatriculaSubmitResponse(
        status="created",
        login_email=str(payload.student.email),
        message="Matrícula na academia confirmada. Baixe o app e faça login.",
    )

