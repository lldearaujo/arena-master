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


@router.get("/", response_model=list[schemas.CheckInRead])
async def list_checkins(
    admin: AdminDep,
    session: SessionDep,
    turma_id: int | None = Query(default=None),
    student_id: int | None = Query(default=None),
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
        start_date=_parse(start_date),
        end_date=_parse(end_date),
    )
    checkins = await service.list_checkins(session, admin.dojo_id, filters)
    return [schemas.CheckInRead.model_validate(c) for c in checkins]

