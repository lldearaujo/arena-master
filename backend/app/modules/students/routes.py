from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_user
from app.models.faixa import Faixa
from app.models.student import Student
from app.models.user import User
from app.modules.students import schemas, service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]
UserDep = Annotated[User, Depends(get_current_user)]


async def _student_to_read(
    session: SessionDep,
    student: Student,
) -> schemas.StudentRead:
    graduacao = await service.get_graduacao_display(session, student)
    modalidade_display = await service.display_modalidade_for_student(session, student)
    exibir_grad = await service.exibir_graduacao_no_perfil(
        session, student, modalidade_display
    )
    return schemas.StudentRead(
        id=student.id,
        dojo_id=student.dojo_id,
        external_dojo_name=student.external_dojo_name,
        external_faixa_label=student.external_faixa_label,
        user_id=student.user_id,
        name=student.name,
        email=student.email,
        phone=student.phone,
        birth_date=student.birth_date,
        modalidade=modalidade_display,
        notes=student.notes,
        faixa_id=student.faixa_id,
        grau=student.grau,
        graduacao=graduacao,
        exibir_graduacao_no_perfil=exibir_grad,
    )


@router.get("/", response_model=list[schemas.StudentWithLoginRead])
async def list_students(
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.StudentWithLoginRead]:
    students = await service.list_students(session, admin.dojo_id)

    # Busca os logins (emails de acesso) dos usuários vinculados aos alunos
    user_ids = [s.user_id for s in students if s.user_id is not None]
    login_by_user_id: dict[int, str] = {}
    active_by_user_id: dict[int, bool] = {}
    if user_ids:
        result = await session.execute(
            select(User.id, User.email, User.is_active).where(User.id.in_(user_ids))
        )
        for user_id, email, is_active in result.all():
            login_by_user_id[user_id] = email
            active_by_user_id[user_id] = bool(is_active)

    # Faixas em lote (evita N+1 em get_graduacao_display por aluno)
    faixa_ids = {s.faixa_id for s in students if s.faixa_id is not None}
    faixa_by_id: dict[int, Faixa] = {}
    if faixa_ids:
        r_fx = await session.execute(select(Faixa).where(Faixa.id.in_(faixa_ids)))
        faixa_by_id = {f.id: f for f in r_fx.scalars().all()}

    items: list[schemas.StudentWithLoginRead] = []
    for s in students:
        login_email = login_by_user_id.get(s.user_id) if s.user_id is not None else None
        is_active = active_by_user_id.get(s.user_id, True) if s.user_id is not None else True
        graduacao = service.graduacao_display_with_faixa_map(s, faixa_by_id)
        base = schemas.StudentRead(
            id=s.id,
            dojo_id=s.dojo_id,
            external_dojo_name=s.external_dojo_name,
            external_faixa_label=s.external_faixa_label,
            user_id=s.user_id,
            name=s.name,
            email=s.email,
            phone=s.phone,
            birth_date=s.birth_date,
            modalidade=s.modalidade,
            notes=s.notes,
            faixa_id=s.faixa_id,
            grau=s.grau,
            graduacao=graduacao,
        )
        items.append(
            schemas.StudentWithLoginRead(
                **base.model_dump(),
                login_email=login_email,
                is_active=is_active,
            )
        )
    return items


@router.post(
    "/",
    response_model=schemas.StudentCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_student(
    payload: schemas.StudentCreate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.StudentCreatedResponse:
    try:
        student, initial_password, login_email = await service.create_student(
            session, admin.dojo_id, payload
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    student_read = await _student_to_read(session, student)
    return schemas.StudentCreatedResponse(
        student=student_read,
        initial_password=initial_password,
        login_email=login_email,
    )


# Rotas literais antes de /{student_id} — senão "me" casa como string e vira 403 (admin).
@router.get("/me", response_model=schemas.StudentRead)
async def get_me(
    user: UserDep,
    session: SessionDep,
) -> schemas.StudentRead:
    student = await service.get_student_for_user(session, user)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado para este usuário",
        )
    return await _student_to_read(session, student)


@router.get("/{student_id:int}", response_model=schemas.StudentRead)
async def get_student(
    student_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.StudentRead:
    student = await service.get_student(session, admin.dojo_id, student_id)
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado",
        )
    return await _student_to_read(session, student)


@router.post(
    "/{student_id:int}/reset-password",
    response_model=schemas.StudentPasswordResetResponse,
)
async def reset_student_password(
    student_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.StudentPasswordResetResponse:
    """Redefine a senha de acesso do aluno para o padrão (aluno + ID com 4 dígitos)."""
    result = await service.reset_student_password_to_default(
        session, admin.dojo_id, student_id
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado ou sem conta de acesso vinculada",
        )
    default_password, login_email = result
    return schemas.StudentPasswordResetResponse(
        default_password=default_password,
        login_email=login_email,
    )


@router.put("/{student_id:int}", response_model=schemas.StudentRead)
async def update_student(
    student_id: int,
    payload: schemas.StudentUpdate,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.StudentRead:
    try:
        student = await service.update_student(
            session,
            admin.dojo_id,
            student_id,
            payload,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado",
        )
    return await _student_to_read(session, student)


@router.delete("/{student_id:int}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    deleted = await service.delete_student(session, admin.dojo_id, student_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aluno não encontrado",
        )


@router.get("/{student_id:int}/guardians", response_model=list[schemas.GuardianRead])
async def list_student_guardians(
    student_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> list[schemas.GuardianRead]:
    guardians = await service.list_guardians(
        session,
        admin.dojo_id,
        student_id,
    )
    return [schemas.GuardianRead.model_validate(g) for g in guardians]


@router.post(
    "/{student_id:int}/guardians",
    response_model=schemas.GuardianRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_student_guardian(
    student_id: int,
    payload: schemas.GuardianLink,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.GuardianRead:
    try:
        guardian = await service.add_guardian(
            session,
            admin.dojo_id,
            student_id,
            payload,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    return schemas.GuardianRead.model_validate(guardian)


@router.delete("/{student_id:int}/guardians/{user_id:int}", status_code=204)
async def remove_student_guardian(
    student_id: int,
    user_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> None:
    removed = await service.remove_guardian(
        session,
        admin.dojo_id,
        student_id,
        user_id,
    )
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Responsável não encontrado para este aluno",
        )

