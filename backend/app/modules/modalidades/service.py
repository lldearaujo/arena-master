from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dojo_modalidade import DojoModalidade
from app.models.student import Student
from app.models.turma import Turma
from app.modules.modalidades.schemas import ModalidadeCreate, ModalidadeUpdate
from app.modules.turmas import service as turmas_service


async def list_modalidades(
    session: AsyncSession,
    dojo_id: int,
) -> list[DojoModalidade]:
    result = await session.execute(
        select(DojoModalidade)
        .where(DojoModalidade.dojo_id == dojo_id)
        .order_by(func.lower(DojoModalidade.name))
    )
    return list(result.scalars().all())


def _coerce_skills_labels_from_row(row: DojoModalidade | None) -> list[str] | None:
    if row is None:
        return None
    raw = getattr(row, "skills_labels", None)
    if raw is None:
        return None
    if not isinstance(raw, list) or len(raw) != 5:
        return None
    out = [str(x).strip() for x in raw]
    if any(not s for s in out):
        return None
    return out


async def list_modalidades_unificadas(
    session: AsyncSession,
    dojo_id: int,
) -> list[tuple[int | None, str, bool, bool, list[str] | None]]:
    """(id, nome, em_catalogo, has_graduation_system, skills_labels). Legado sem id: skills_labels None."""
    catalog = await list_modalidades(session, dojo_id)
    seen: set[str] = set()
    out: list[tuple[int | None, str, bool, bool, list[str] | None]] = []

    for row in catalog:
        key = row.name.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(
            (
                row.id,
                row.name,
                True,
                bool(row.has_graduation_system),
                _coerce_skills_labels_from_row(row),
            )
        )

    todas_strings = await turmas_service.list_modalidades_for_dojo(session, dojo_id)
    for nome in todas_strings:
        key = nome.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append((None, nome, False, True, None))

    out.sort(key=lambda x: x[1].casefold())
    return out


async def get_modalidade_by_name_casefold(
    session: AsyncSession,
    dojo_id: int,
    name: str,
) -> DojoModalidade | None:
    nm = name.strip()
    if not nm:
        return None
    result = await session.execute(
        select(DojoModalidade).where(
            and_(
                DojoModalidade.dojo_id == dojo_id,
                func.lower(DojoModalidade.name) == func.lower(nm),
            )
        )
    )
    return result.scalar_one_or_none()


async def get_modalidade_by_name_exact(
    session: AsyncSession,
    dojo_id: int,
    name: str,
) -> DojoModalidade | None:
    result = await session.execute(
        select(DojoModalidade).where(
            and_(
                DojoModalidade.dojo_id == dojo_id,
                DojoModalidade.name == name,
            )
        )
    )
    return result.scalar_one_or_none()


async def rename_modalidade_por_nome(
    session: AsyncSession,
    dojo_id: int,
    old_name: str,
    new_name: str,
) -> None:
    if old_name == new_name:
        return

    cat_old = await get_modalidade_by_name_exact(session, dojo_id, old_name)
    dup = await session.execute(
        select(DojoModalidade).where(
            and_(
                DojoModalidade.dojo_id == dojo_id,
                func.lower(DojoModalidade.name) == func.lower(new_name),
            )
        )
    )
    for other in dup.scalars().all():
        if cat_old is not None and other.id == cat_old.id:
            continue
        raise ValueError("Já existe uma modalidade com esse nome neste dojo")

    await session.execute(
        update(Student)
        .where(
            and_(
                Student.dojo_id == dojo_id,
                Student.modalidade == old_name,
            )
        )
        .values(modalidade=new_name)
    )
    await session.execute(
        update(Turma)
        .where(
            and_(
                Turma.dojo_id == dojo_id,
                Turma.modalidade == old_name,
            )
        )
        .values(modalidade=new_name)
    )

    if cat_old is not None:
        cat_old.name = new_name

    await session.commit()


async def limpar_modalidade_por_nome(
    session: AsyncSession,
    dojo_id: int,
    name: str,
) -> None:
    """Remove o texto de modalidade de turmas e alunos (referências órfãs)."""
    await session.execute(
        update(Student)
        .where(
            and_(
                Student.dojo_id == dojo_id,
                Student.modalidade == name,
            )
        )
        .values(modalidade=None)
    )
    await session.execute(
        update(Turma)
        .where(
            and_(
                Turma.dojo_id == dojo_id,
                Turma.modalidade == name,
            )
        )
        .values(modalidade=None)
    )
    await session.commit()


async def get_modalidade(
    session: AsyncSession,
    dojo_id: int,
    modalidade_id: int,
) -> DojoModalidade | None:
    result = await session.execute(
        select(DojoModalidade).where(
            and_(
                DojoModalidade.id == modalidade_id,
                DojoModalidade.dojo_id == dojo_id,
            )
        )
    )
    return result.scalar_one_or_none()


async def create_modalidade(
    session: AsyncSession,
    dojo_id: int,
    data: ModalidadeCreate,
) -> DojoModalidade:
    name = data.name
    dup = await session.execute(
        select(DojoModalidade).where(
            and_(
                DojoModalidade.dojo_id == dojo_id,
                func.lower(DojoModalidade.name) == func.lower(name),
            )
        )
    )
    if dup.scalar_one_or_none() is not None:
        raise ValueError("Já existe uma modalidade com esse nome neste dojo")

    row = DojoModalidade(
        dojo_id=dojo_id,
        name=name,
        has_graduation_system=data.has_graduation_system,
        skills_labels=data.skills_labels,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def update_modalidade(
    session: AsyncSession,
    dojo_id: int,
    modalidade_id: int,
    data: ModalidadeUpdate,
) -> DojoModalidade | None:
    row = await get_modalidade(session, dojo_id, modalidade_id)
    if row is None:
        return None

    old_name = row.name
    new_name = data.name
    if old_name != new_name:
        dup = await session.execute(
            select(DojoModalidade).where(
                and_(
                    DojoModalidade.dojo_id == dojo_id,
                    DojoModalidade.id != modalidade_id,
                    func.lower(DojoModalidade.name) == func.lower(new_name),
                )
            )
        )
        if dup.scalar_one_or_none() is not None:
            raise ValueError("Já existe uma modalidade com esse nome neste dojo")

        await session.execute(
            update(Student)
            .where(
                and_(
                    Student.dojo_id == dojo_id,
                    Student.modalidade == old_name,
                )
            )
            .values(modalidade=new_name)
        )
        await session.execute(
            update(Turma)
            .where(
                and_(
                    Turma.dojo_id == dojo_id,
                    Turma.modalidade == old_name,
                )
            )
            .values(modalidade=new_name)
        )

    row.name = new_name
    dump = data.model_dump(exclude_unset=True)
    if "has_graduation_system" in dump and data.has_graduation_system is not None:
        row.has_graduation_system = data.has_graduation_system
    if "skills_labels" in dump:
        row.skills_labels = data.skills_labels
    await session.commit()
    await session.refresh(row)
    return row


async def is_modalidade_in_use(
    session: AsyncSession,
    dojo_id: int,
    name: str,
) -> bool:
    t = await session.execute(
        select(Turma.id).where(
            and_(
                Turma.dojo_id == dojo_id,
                Turma.modalidade == name,
            )
        ).limit(1)
    )
    if t.scalar_one_or_none() is not None:
        return True
    s = await session.execute(
        select(Student.id).where(
            and_(
                Student.dojo_id == dojo_id,
                Student.modalidade == name,
            )
        ).limit(1)
    )
    return s.scalar_one_or_none() is not None


async def delete_modalidade(
    session: AsyncSession,
    dojo_id: int,
    modalidade_id: int,
) -> bool:
    row = await get_modalidade(session, dojo_id, modalidade_id)
    if row is None:
        return False

    if await is_modalidade_in_use(session, dojo_id, row.name):
        raise ValueError(
            "Não é possível excluir: modalidade em uso em turmas ou alunos",
        )

    await session.delete(row)
    await session.commit()
    return True
