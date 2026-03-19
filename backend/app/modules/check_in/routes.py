from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_user
from app.models.user import User
from app.modules.check_in import schemas, service


router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
AdminDep = Annotated[User, Depends(get_current_admin)]
UserDep = Annotated[User, Depends(get_current_user)]


@router.post(
    "/",
    response_model=schemas.CheckInRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_checkin(
    payload: schemas.CheckInCreate,
    user: UserDep,
    session: SessionDep,
) -> schemas.CheckInRead:
    try:
        checkin = await service.create_checkin(session, user, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return schemas.CheckInRead.model_validate(checkin)


@router.get("/my", response_model=list[schemas.CheckInRead])
async def list_my_checkins(
    user: UserDep,
    session: SessionDep,
    date_str: str | None = Query(default=None, alias="date"),
) -> list[schemas.CheckInRead]:
    """Retorna os check-ins do dia do usuário logado (aluno ou responsável)."""
    from datetime import date as _date

    target = None
    if date_str:
        try:
            target = _date.fromisoformat(date_str)
        except ValueError:
            pass

    checkins = await service.list_my_checkins(session, user, target)
    return [schemas.CheckInRead.model_validate(c) for c in checkins]


@router.get("/my/range", response_model=list[schemas.CheckInRead])
async def list_my_checkins_range(
    user: UserDep,
    session: SessionDep,
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
) -> list[schemas.CheckInRead]:
    """Retorna os check-ins do aluno no intervalo de datas (para assiduidade)."""
    from datetime import date as _date

    try:
        start = _date.fromisoformat(start_date)
        end = _date.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datas inválidas. Use formato YYYY-MM-DD.",
        ) from None
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date deve ser anterior a end_date.",
        )
    checkins = await service.list_my_checkins_in_range(session, user, start, end)
    return [schemas.CheckInRead.model_validate(c) for c in checkins]


@router.delete("/{checkin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_checkin(
    checkin_id: int,
    user: UserDep,
    session: SessionDep,
) -> None:
    """Cancela um check-in do dia (apenas o próprio ou quem fez o check-in)."""
    removed = await service.cancel_checkin(session, user, checkin_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check-in não encontrado ou você não pode cancelá-lo",
        )


@router.post(
    "/{checkin_id}/confirm",
    response_model=schemas.CheckInRead,
)
async def confirm_checkin_presence(
    checkin_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.CheckInRead:
    """Confirma a presença do aluno para um check-in (apenas admin)."""
    checkin = await service.confirm_presence(session, admin, checkin_id)
    if checkin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check-in não encontrado ou você não pode confirmá-lo",
        )
    return schemas.CheckInRead.model_validate(checkin)


@router.post(
    "/{checkin_id}/mark-absent",
    response_model=schemas.CheckInRead,
)
async def mark_checkin_absent(
    checkin_id: int,
    admin: AdminDep,
    session: SessionDep,
) -> schemas.CheckInRead:
    """Marca o aluno como ausente (não veio) e devolve 1 crédito ao score (apenas admin)."""
    checkin = await service.mark_checkin_absent(session, admin, checkin_id)
    if checkin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check-in não encontrado, já confirmado ou já marcado como ausente",
        )
    return schemas.CheckInRead.model_validate(checkin)


@router.get("/", response_model=list[schemas.CheckInRead])
async def list_checkins(
    admin: AdminDep,
    session: SessionDep,
    turma_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
    student_name: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
) -> list[schemas.CheckInRead]:
    # conversão simples de datas (YYYY-MM-DD)
    from datetime import date as _date  # import local para evitar poluir módulo

    def _parse(d: str | None) -> _date | None:
        if not d:
            return None
        return _date.fromisoformat(d)

    filters = schemas.CheckInFilter(
        turma_id=turma_id,
        student_id=student_id,
        student_name=student_name,
        start_date=_parse(start_date),
        end_date=_parse(end_date),
    )
    rows = await service.list_checkins(session, admin.dojo_id, filters)
    response: list[schemas.CheckInRead] = []
    for checkin, student_name, score, turma_name in rows:
        base = schemas.CheckInRead.model_validate(checkin)
        enriched = base.model_copy(
            update={
                "student_name": student_name,
                "score": score,
                "turma_name": turma_name,
            }
        )
        response.append(enriched)
    return response

