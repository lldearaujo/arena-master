from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_current_admin,
    get_current_user,
    get_user_from_access_token,
)
from app.models.competition import Competition
from app.models.user import User
from app.modules.competitions import schemas, service
from app.modules.competitions.federation_presets import list_preset_summaries
from app.modules.competitions.ws_manager import competition_ws_hub

router = APIRouter()

SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[User, Depends(get_current_user)]
AdminOnlyDep = Annotated[User, Depends(get_current_admin)]


async def _broadcast(comp_id: int, msg: dict) -> None:
    await competition_ws_hub.broadcast(comp_id, msg)


@router.get("/", response_model=list[schemas.CompetitionRead])
async def list_competitions(user: UserDep, session: SessionDep) -> list:
    items = await service.list_competitions(session, user)
    return [schemas.CompetitionRead.model_validate(c) for c in items]


@router.get("/me/my-registrations", response_model=list[schemas.RegistrationRead])
async def my_competition_registrations(user: UserDep, session: SessionDep) -> list:
    return await service.list_my_registration_summaries(session, user)


@router.get("/me/notifications")
async def my_notifications(user: UserDep, session: SessionDep) -> list:
    rows = await service.list_notifications(session, user)
    return [
        {
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "created_at": n.created_at.isoformat(),
            "sent_at": n.sent_at.isoformat() if n.sent_at else None,
        }
        for n in rows
    ]


@router.get("/public/{public_token}/mats", response_model=list[schemas.PublicMatStatus])
async def public_mats(public_token: str, session: SessionDep) -> list:
    return await service.public_mat_statuses(session, public_token)


@router.get(
    "/public/enroll/{competition_id}/summary",
    response_model=schemas.CompetitionRead,
)
async def public_enroll_summary(competition_id: int, session: SessionDep) -> schemas.CompetitionRead:
    return await service.get_public_competition_summary(session, competition_id)


@router.get(
    "/public/enroll/{competition_id}/eligibility-options",
    response_model=schemas.EligibilityOptionsResponse,
)
async def public_enroll_eligibility_options(
    competition_id: int,
    session: SessionDep,
    gender: str | None = Query(None),
    birth_year: int | None = Query(None),
    modality: str | None = Query(None, pattern="^(gi|nogi)$"),
) -> schemas.EligibilityOptionsResponse:
    return await service.get_public_eligibility_options(
        session, competition_id, gender, birth_year, modality
    )


@router.post(
    "/public/enroll/{competition_id}",
    response_model=schemas.PublicCompetitionRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def public_enroll_register(
    competition_id: int,
    payload: schemas.PublicCompetitionRegistrationCreate,
    session: SessionDep,
) -> schemas.PublicCompetitionRegistrationResponse:
    reg, user = await service.register_public_competition(session, competition_id, payload)
    rr = await service.registration_to_read(session, reg)
    access = create_access_token(str(user.id), user.role, user.dojo_id)
    refresh = create_refresh_token(str(user.id), user.role, user.dojo_id)
    return schemas.PublicCompetitionRegistrationResponse(
        registration=rr,
        access_token=access,
        refresh_token=refresh,
        user=schemas.PublicRegistrationUserRead.model_validate(user),
    )


@router.post("/", response_model=schemas.CompetitionRead, status_code=status.HTTP_201_CREATED)
async def create_competition(
    payload: schemas.CompetitionCreate,
    admin: AdminOnlyDep,
    session: SessionDep,
) -> schemas.CompetitionRead:
    c = await service.create_competition(session, admin, payload)
    return await service.competition_read_with_organizer(session, c)


@router.get("/organizer-kpis", response_model=list[schemas.CompetitionKpiItem])
async def organizer_competition_kpis(user: UserDep, session: SessionDep) -> list[schemas.CompetitionKpiItem]:
    return await service.list_organizer_kpis(session, user)


@router.get("/organizer/pending-registration-payments", response_model=list[schemas.RegistrationRead])
async def organizer_pending_registration_payments(
    user: UserDep, session: SessionDep
) -> list[schemas.RegistrationRead]:
    return await service.list_organizer_pending_registration_payments(session, user)


@router.get("/federation-presets", response_model=list[schemas.FederationPresetSummary])
async def federation_presets_list(user: UserDep) -> list[schemas.FederationPresetSummary]:
    if user.role not in ("superadmin", "admin") or (user.role == "admin" and user.dojo_id is None):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissão")
    rows = list_preset_summaries()
    return [schemas.FederationPresetSummary.model_validate(x) for x in rows]


@router.post(
    "/{competition_id}/apply-federation-preset",
    response_model=schemas.ApplyFederationPresetResponse,
)
async def apply_federation_preset_ep(
    competition_id: int,
    payload: schemas.ApplyFederationPresetBody,
    admin: UserDep,
    session: SessionDep,
) -> schemas.ApplyFederationPresetResponse:
    return await service.apply_federation_preset(session, admin, competition_id, payload.preset_code)


@router.get("/{competition_id}", response_model=schemas.CompetitionRead)
async def get_competition(
    competition_id: int,
    user: UserDep,
    session: SessionDep,
) -> schemas.CompetitionRead:
    c = await service.get_competition(session, user, competition_id)
    return schemas.CompetitionRead.model_validate(c)


@router.patch("/{competition_id}", response_model=schemas.CompetitionRead)
async def patch_competition(
    competition_id: int,
    payload: schemas.CompetitionUpdate,
    admin: UserDep,
    session: SessionDep,
) -> schemas.CompetitionRead:
    c = await service.update_competition(session, admin, competition_id, payload)
    return await service.competition_read_with_organizer(session, c)


@router.post(
    "/{competition_id}/age-divisions",
    response_model=schemas.AgeDivisionRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_age_division(
    competition_id: int,
    payload: schemas.AgeDivisionCreate,
    admin: UserDep,
    session: SessionDep,
) -> schemas.AgeDivisionRead:
    d = await service.create_age_division(session, admin, competition_id, payload)
    return schemas.AgeDivisionRead.model_validate(d)


@router.get("/{competition_id}/age-divisions", response_model=list[schemas.AgeDivisionRead])
async def get_age_divisions(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
) -> list:
    rows = await service.list_age_divisions(session, admin, competition_id)
    return [schemas.AgeDivisionRead.model_validate(x) for x in rows]


@router.post(
    "/{competition_id}/weight-classes",
    response_model=schemas.WeightClassRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_weight_class(
    competition_id: int,
    payload: schemas.WeightClassCreate,
    admin: UserDep,
    session: SessionDep,
) -> schemas.WeightClassRead:
    w = await service.create_weight_class(session, admin, competition_id, payload)
    rows = await service.list_weight_classes(session, admin, competition_id)
    reads = service.weight_classes_to_read(rows)
    return next(r for r in reads if r.id == w.id)


@router.get("/{competition_id}/weight-classes", response_model=list[schemas.WeightClassRead])
async def get_weight_classes(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
) -> list:
    rows = await service.list_weight_classes(session, admin, competition_id)
    return service.weight_classes_to_read(rows)


@router.post(
    "/{competition_id}/belt-eligibility",
    response_model=schemas.BeltEligibilityRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_belt_eligibility(
    competition_id: int,
    payload: schemas.BeltEligibilityCreate,
    admin: UserDep,
    session: SessionDep,
) -> schemas.BeltEligibilityRead:
    b = await service.add_belt_eligibility(session, admin, competition_id, payload)
    return schemas.BeltEligibilityRead.model_validate(b)


@router.get(
    "/{competition_id}/belt-eligibility",
    response_model=list[schemas.BeltEligibilityRead],
)
async def list_belt_elig(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
) -> list:
    rows = await service.list_belt_eligibility(session, admin, competition_id)
    return [schemas.BeltEligibilityRead.model_validate(x) for x in rows]


@router.get("/{competition_id}/eligibility-options", response_model=schemas.EligibilityOptionsResponse)
async def eligibility_options(
    competition_id: int,
    user: UserDep,
    session: SessionDep,
    gender: str | None = Query(None),
    birth_year: int | None = Query(None),
    modality: str | None = Query(None, pattern="^(gi|nogi)$"),
) -> schemas.EligibilityOptionsResponse:
    return await service.get_eligibility_options(
        session, user, competition_id, gender, birth_year, modality
    )


@router.post(
    "/{competition_id}/registrations",
    response_model=schemas.RegistrationRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_registration(
    competition_id: int,
    payload: schemas.RegistrationCreate,
    user: UserDep,
    session: SessionDep,
) -> schemas.RegistrationRead:
    r = await service.create_registration(session, user, competition_id, payload)
    return await service.registration_to_read(session, r)


@router.get("/{competition_id}/registrations", response_model=list[schemas.RegistrationRead])
async def get_registrations(
    competition_id: int,
    user: UserDep,
    session: SessionDep,
) -> list:
    rows = await service.list_registrations(session, user, competition_id)
    return await service.registrations_to_read_many(session, rows)


@router.get("/{competition_id}/registrations/weigh-in/search", response_model=list[schemas.WeighInSearchResult])
async def weigh_in_search(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
    q: str = Query("", min_length=1),
) -> list:
    return await service.search_registration_for_weigh_in(session, admin, competition_id, q)


@router.get("/{competition_id}/registrations/by-code/{code}", response_model=schemas.RegistrationRead)
async def registration_by_code(
    competition_id: int,
    code: str,
    admin: UserDep,
    session: SessionDep,
) -> schemas.RegistrationRead:
    r = await service.get_registration_by_code(session, admin, competition_id, code)
    return await service.registration_to_read(session, r)


@router.patch("/{competition_id}/registrations/{registration_id}/weigh-in", response_model=schemas.RegistrationRead)
async def weigh_in(
    competition_id: int,
    registration_id: int,
    payload: schemas.WeighInPayload,
    admin: UserDep,
    session: SessionDep,
) -> schemas.RegistrationRead:
    r = await service.weigh_in_registration(session, admin, competition_id, registration_id, payload)
    await _broadcast(competition_id, {"type": "weigh_in", "registration_id": registration_id})
    return await service.registration_to_read(session, r)


@router.patch("/{competition_id}/registrations/{registration_id}/ranking-points", response_model=schemas.RegistrationRead)
async def patch_ranking(
    competition_id: int,
    registration_id: int,
    body: schemas.RankingPointsBody,
    admin: UserDep,
    session: SessionDep,
) -> schemas.RegistrationRead:
    r = await service.update_ranking_points(session, admin, competition_id, registration_id, body.points)
    return await service.registration_to_read(session, r)


@router.post("/{competition_id}/banner", response_model=schemas.CompetitionRead)
async def upload_competition_banner(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
    file: UploadFile = File(...),
) -> schemas.CompetitionRead:
    static_dir = Path(__file__).resolve().parents[4] / "static" / "competition-banners"
    static_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "").suffix.lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    filename = f"comp_{competition_id}_banner{ext}"
    dest_path = static_dir / filename
    dest_path.write_bytes(await file.read())
    public_path = f"/static/competition-banners/{filename}"
    c = await service.attach_competition_banner(session, admin, competition_id, public_path)
    return await service.competition_read_with_organizer(session, c)


@router.post(
    "/{competition_id}/registrations/{registration_id}/payment-receipt",
    response_model=schemas.RegistrationRead,
)
async def upload_registration_payment_receipt(
    competition_id: int,
    registration_id: int,
    user: UserDep,
    session: SessionDep,
    file: UploadFile = File(...),
) -> schemas.RegistrationRead:
    static_dir = Path(__file__).resolve().parents[4] / "static" / "receipts"
    static_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "").suffix or ".bin"
    filename = f"comp_reg_{registration_id}{ext}"
    dest_path = static_dir / filename
    dest_path.write_bytes(await file.read())
    public_path = f"/static/receipts/{filename}"
    r = await service.attach_registration_payment_receipt(
        session, user, competition_id, registration_id, public_path
    )
    return await service.registration_to_read(session, r)


@router.post(
    "/{competition_id}/registrations/{registration_id}/confirm-payment",
    response_model=schemas.RegistrationRead,
)
async def confirm_registration_payment_ep(
    competition_id: int,
    registration_id: int,
    admin: UserDep,
    session: SessionDep,
) -> schemas.RegistrationRead:
    r = await service.confirm_registration_payment(session, admin, competition_id, registration_id)
    await _broadcast(competition_id, {"type": "registration_payment_confirmed", "registration_id": registration_id})
    return await service.registration_to_read(session, r)


@router.post(
    "/{competition_id}/registrations/{registration_id}/reject-payment",
    response_model=schemas.RegistrationRead,
)
async def reject_registration_payment_ep(
    competition_id: int,
    registration_id: int,
    admin: UserDep,
    session: SessionDep,
    body: schemas.RegistrationPaymentRejectBody | None = Body(None),
) -> schemas.RegistrationRead:
    r = await service.reject_registration_payment(
        session, admin, competition_id, registration_id, body
    )
    await _broadcast(competition_id, {"type": "registration_payment_rejected", "registration_id": registration_id})
    return await service.registration_to_read(session, r)


@router.post("/{competition_id}/brackets/generate", response_model=schemas.BracketGenerateResponse)
async def gen_bracket(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
    age_division_id: int = Query(...),
    weight_class_id: int = Query(...),
    gender: str = Query(..., pattern="^(male|female)$"),
) -> schemas.BracketGenerateResponse:
    res = await service.generate_bracket(
        session, admin, competition_id, age_division_id, weight_class_id, gender
    )
    await _broadcast(competition_id, {"type": "bracket_generated", "bracket_id": res.bracket_id})
    return res


@router.post(
    "/{competition_id}/brackets/generate-all",
    response_model=schemas.BracketsGenerateAllResponse,
)
async def gen_all_brackets(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
) -> schemas.BracketsGenerateAllResponse:
    res = await service.generate_all_brackets(session, admin, competition_id)
    for bid in res.generated_bracket_ids:
        await _broadcast(competition_id, {"type": "bracket_generated", "bracket_id": bid})
    await _broadcast(competition_id, {"type": "brackets_generated_all", "generated_brackets": res.generated_brackets})
    return res


@router.get("/{competition_id}/brackets", response_model=list[schemas.BracketRead])
async def list_brackets_ep(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
) -> list:
    rows = await service.list_brackets(session, admin, competition_id)
    return [schemas.BracketRead.model_validate(x) for x in rows]


@router.post("/{competition_id}/registrations/{registration_id}/promote", response_model=schemas.RegistrationRead)
async def promote_reg(
    competition_id: int,
    registration_id: int,
    payload: schemas.PromoteRegistrationPayload,
    admin: UserDep,
    session: SessionDep,
) -> schemas.RegistrationRead:
    r = await service.promote_registration(session, admin, competition_id, registration_id, payload)
    await _broadcast(competition_id, {"type": "registration_promoted", "registration_id": registration_id})
    return await service.registration_to_read(session, r)


@router.post(
    "/{competition_id}/mats",
    response_model=schemas.MatRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_mat(
    competition_id: int,
    payload: schemas.MatCreate,
    admin: UserDep,
    session: SessionDep,
) -> schemas.MatRead:
    m = await service.create_mat(session, admin, competition_id, payload)
    return schemas.MatRead.model_validate(m)


@router.get("/{competition_id}/mats", response_model=list[schemas.MatRead])
async def list_mats_ep(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
) -> list:
    rows = await service.list_mats(session, admin, competition_id)
    return [schemas.MatRead.model_validate(x) for x in rows]


@router.patch("/{competition_id}/matches/{match_id}/mat", response_model=schemas.MatchRead)
async def assign_mat_ep(
    competition_id: int,
    match_id: int,
    payload: schemas.AssignMatchMatPayload,
    admin: UserDep,
    session: SessionDep,
) -> schemas.MatchRead:
    m = await service.assign_match_mat(session, admin, competition_id, match_id, payload)
    await _broadcast(competition_id, {"type": "match_mat", "match_id": match_id})
    return schemas.MatchRead.model_validate(m)


@router.post("/{competition_id}/schedule/recompute", status_code=status.HTTP_204_NO_CONTENT)
async def recompute_ep(competition_id: int, admin: UserDep, session: SessionDep) -> None:
    await service.recompute_mat_schedule(session, competition_id)
    await _broadcast(competition_id, {"type": "schedule_recomputed"})


@router.get("/{competition_id}/matches", response_model=list[schemas.MatchRead])
async def list_matches_ep(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
) -> list:
    rows = await service.list_matches_for_competition(session, admin, competition_id)
    return [schemas.MatchRead.model_validate(x) for x in rows]


@router.patch("/{competition_id}/matches/{match_id}/score", response_model=schemas.MatchRead)
async def patch_score(
    competition_id: int,
    match_id: int,
    payload: schemas.MatchScoreUpdate,
    admin: UserDep,
    session: SessionDep,
) -> schemas.MatchRead:
    m = await service.update_match_scores(session, admin, competition_id, match_id, payload)
    await _broadcast(competition_id, {"type": "match_score", "match_id": match_id, "payload": payload.model_dump()})
    return schemas.MatchRead.model_validate(m)


@router.post("/{competition_id}/matches/{match_id}/finish", response_model=schemas.MatchRead)
async def finish_match_ep(
    competition_id: int,
    match_id: int,
    payload: schemas.MatchFinishPayload,
    admin: UserDep,
    session: SessionDep,
) -> schemas.MatchRead:
    m = await service.finish_match(session, admin, competition_id, match_id, payload)
    await _broadcast(competition_id, {"type": "match_finished", "match_id": match_id})
    return schemas.MatchRead.model_validate(m)


@router.patch("/{competition_id}/matches/{match_id}/display-status", response_model=schemas.MatchRead)
async def display_status_ep(
    competition_id: int,
    match_id: int,
    admin: UserDep,
    session: SessionDep,
    display_status: str = Query(..., description="scheduled | warm_up | on_deck | on_mat | completed | cancelled"),
) -> schemas.MatchRead:
    m = await service.set_match_display_status(session, admin, competition_id, match_id, display_status)
    await _broadcast(competition_id, {"type": "match_display", "match_id": match_id, "status": display_status})
    return schemas.MatchRead.model_validate(m)


@router.get("/{competition_id}/coach/dashboard", response_model=schemas.CoachDashboardResponse)
async def coach_dash(
    competition_id: int,
    admin: UserDep,
    session: SessionDep,
) -> schemas.CoachDashboardResponse:
    return await service.coach_dashboard(session, admin, competition_id)


@router.websocket("/ws/{competition_id}")
async def competition_ws(websocket: WebSocket, competition_id: int, session: SessionDep) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return
    user = await get_user_from_access_token(session, token)
    if user is None:
        await websocket.close(code=4401)
        return
    from sqlalchemy import select

    r = await session.execute(select(Competition).where(Competition.id == competition_id))
    comp = r.scalar_one_or_none()
    if comp is None:
        await websocket.close(code=4404)
        return
    allowed = user.role == "superadmin" or (
        user.role == "admin" and user.dojo_id == comp.organizer_dojo_id
    )
    if not allowed:
        await websocket.close(code=4403)
        return

    await competition_ws_hub.connect(competition_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        competition_ws_hub.disconnect(competition_id, websocket)
