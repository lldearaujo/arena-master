from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.skills import DojoSkillsConfig, StudentSkillsRating
from app.models.student import Student
from app.modules.modalidades import service as modalidades_service
from app.modules.students import service as students_service


DEFAULT_SKILLS = ["Técnica", "Força", "Cardio", "Disciplina", "Estratégia"]


def _normalize_skills(skills: list[str]) -> list[str]:
    cleaned = [s.strip() for s in skills]
    if len(cleaned) != 5:
        raise ValueError("Envie exatamente 5 habilidades")
    if any(not s for s in cleaned):
        raise ValueError("Nenhuma habilidade pode ficar vazia")
    if len(set(cleaned)) != 5:
        raise ValueError("As habilidades devem ser únicas")
    return cleaned


def _normalize_ratings(ratings: list[int]) -> list[int]:
    if len(ratings) != 5:
        raise ValueError("Envie exatamente 5 notas")
    norm: list[int] = []
    for r in ratings:
        if not isinstance(r, int):
            raise ValueError("Notas inválidas")
        if r < 0 or r > 10:
            raise ValueError("As notas devem estar entre 0 e 10")
        norm.append(r)
    return norm


async def get_or_create_config(session: AsyncSession, dojo_id: int) -> DojoSkillsConfig:
    res = await session.execute(
        select(DojoSkillsConfig).where(DojoSkillsConfig.dojo_id == dojo_id)
    )
    cfg = res.scalar_one_or_none()
    if cfg is not None:
        return cfg

    cfg = DojoSkillsConfig(
        dojo_id=dojo_id,
        skill_1=DEFAULT_SKILLS[0],
        skill_2=DEFAULT_SKILLS[1],
        skill_3=DEFAULT_SKILLS[2],
        skill_4=DEFAULT_SKILLS[3],
        skill_5=DEFAULT_SKILLS[4],
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    session.add(cfg)
    await session.commit()
    await session.refresh(cfg)
    return cfg


async def update_config(session: AsyncSession, dojo_id: int, skills: list[str]) -> DojoSkillsConfig:
    skills = _normalize_skills(skills)
    cfg = await get_or_create_config(session, dojo_id)
    cfg.skill_1, cfg.skill_2, cfg.skill_3, cfg.skill_4, cfg.skill_5 = skills
    await session.commit()
    await session.refresh(cfg)
    return cfg


async def resolve_skill_labels_for_student(
    session: AsyncSession,
    dojo_id: int,
    student: Student,
) -> list[str]:
    """Rótulos das 5 habilidades: catálogo da modalidade do aluno ou padrão do dojo."""
    cfg = await get_or_create_config(session, dojo_id)
    fallback = [cfg.skill_1, cfg.skill_2, cfg.skill_3, cfg.skill_4, cfg.skill_5]

    modalidade_display = await students_service.display_modalidade_for_student(
        session, student
    )
    if not modalidade_display or not str(modalidade_display).strip():
        return fallback

    first_mod = str(modalidade_display).split(",")[0].strip()
    if not first_mod:
        return fallback

    dm = await modalidades_service.get_modalidade_by_name_casefold(
        session, dojo_id, first_mod
    )
    if dm is None:
        return fallback
    raw = getattr(dm, "skills_labels", None)
    if raw is None:
        return fallback
    if not isinstance(raw, list) or len(raw) != 5:
        return fallback
    try:
        return _normalize_skills([str(x).strip() for x in raw])
    except ValueError:
        return fallback


async def get_overview(session: AsyncSession, dojo_id: int) -> dict:
    cfg = await get_or_create_config(session, dojo_id)
    default_skills = [cfg.skill_1, cfg.skill_2, cfg.skill_3, cfg.skill_4, cfg.skill_5]

    students_res = await session.execute(
        select(Student).where(Student.dojo_id == dojo_id).order_by(Student.name.asc())
    )
    students = list(students_res.scalars().all())

    ratings_res = await session.execute(
        select(StudentSkillsRating).where(StudentSkillsRating.dojo_id == dojo_id)
    )
    by_student_id: dict[int, StudentSkillsRating] = {
        r.student_id: r for r in ratings_res.scalars().all()
    }

    items = []
    for student in students:
        skills_labels = await resolve_skill_labels_for_student(session, dojo_id, student)
        rating = by_student_id.get(student.id)
        items.append(
            {
                "student_id": student.id,
                "student_name": student.name,
                "skills": skills_labels,
                "ratings": (
                    [
                        int(rating.rating_1),
                        int(rating.rating_2),
                        int(rating.rating_3),
                        int(rating.rating_4),
                        int(rating.rating_5),
                    ]
                    if rating is not None
                    else None
                ),
            }
        )

    return {"default_skills": default_skills, "students": items}


async def set_student_ratings(
    session: AsyncSession, dojo_id: int, student_id: int, ratings: list[int]
) -> StudentSkillsRating:
    ratings = _normalize_ratings(ratings)

    student_res = await session.execute(
        select(Student).where(Student.id == student_id, Student.dojo_id == dojo_id)
    )
    student = student_res.scalar_one_or_none()
    if student is None:
        raise ValueError("Aluno não encontrado")

    res = await session.execute(
        select(StudentSkillsRating).where(StudentSkillsRating.student_id == student_id)
    )
    row = res.scalar_one_or_none()
    now = datetime.now(UTC)
    if row is None:
        row = StudentSkillsRating(
            dojo_id=dojo_id,
            student_id=student_id,
            rating_1=ratings[0],
            rating_2=ratings[1],
            rating_3=ratings[2],
            rating_4=ratings[3],
            rating_5=ratings[4],
            updated_at=now,
        )
        session.add(row)
    else:
        if row.dojo_id != dojo_id:
            raise ValueError("Aluno inválido para este dojo")
        row.rating_1, row.rating_2, row.rating_3, row.rating_4, row.rating_5 = ratings
        row.updated_at = now

    await session.commit()
    await session.refresh(row)
    return row


async def get_student_skills(
    session: AsyncSession, dojo_id: int, student_id: int
) -> tuple[list[str], list[int]]:
    student_res = await session.execute(
        select(Student).where(Student.id == student_id, Student.dojo_id == dojo_id)
    )
    student = student_res.scalar_one_or_none()
    if student is None:
        cfg = await get_or_create_config(session, dojo_id)
        labels = [cfg.skill_1, cfg.skill_2, cfg.skill_3, cfg.skill_4, cfg.skill_5]
        return labels, [0, 0, 0, 0, 0]

    labels = await resolve_skill_labels_for_student(session, dojo_id, student)

    res = await session.execute(
        select(StudentSkillsRating).where(StudentSkillsRating.student_id == student_id)
    )
    rating = res.scalar_one_or_none()
    if rating is None:
        return labels, [0, 0, 0, 0, 0]
    return labels, [
        int(rating.rating_1),
        int(rating.rating_2),
        int(rating.rating_3),
        int(rating.rating_4),
        int(rating.rating_5),
    ]

