import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, status, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_user, require_superadmin
from app.models.user import User
from app.modules.dojos import schemas, service


router = APIRouter()

# Pasta para uploads (deve ser compatível com o StaticFiles montado em app.main)
# Em app.main, o diretório estático é definido como:
#   static_dir = Path(__file__).resolve().parents[2] / "static"
# Ou seja, com base na raiz "backend/".
# Aqui usamos o mesmo diretório base para garantir que os arquivos de logo
# fiquem acessíveis em /static/uploads/dojos/...
UPLOAD_DIR = Path(__file__).resolve().parents[4] / "static" / "uploads" / "dojos"
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


SessionDep = Annotated[AsyncSession, Depends(get_session)]
SuperAdminDep = Annotated[User, Depends(require_superadmin)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
AdminDep = Annotated[User, Depends(get_current_admin)]


@router.get("/me", response_model=schemas.DojoRead)
async def get_my_dojo(
    current_user: CurrentUserDep,
    session: SessionDep,
) -> schemas.DojoRead:
    if current_user.dojo_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário não está vinculado a um dojo",
        )

    dojo = await service.get_dojo(session, current_user.dojo_id)
    if dojo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dojo não encontrado")
    return schemas.DojoRead.model_validate(dojo)


@router.patch("/me", response_model=schemas.DojoRead)
async def update_my_dojo(
    admin: AdminDep,
    session: SessionDep,
    payload: schemas.DojoUpdate,
) -> schemas.DojoRead:
    """Permite ao admin atualizar o próprio dojo (ex: logo_url)."""
    dojo = await service.update_dojo(session, admin.dojo_id, payload)
    if dojo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dojo não encontrado")
    return schemas.DojoRead.model_validate(dojo)


@router.post("/me/logo", response_model=schemas.DojoRead)
async def upload_my_dojo_logo(
    admin: AdminDep,
    session: SessionDep,
    file: Annotated[UploadFile, File()],
) -> schemas.DojoRead:
    """Upload da logo do dojo do admin."""
    if file.content_type and file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Use PNG, JPG ou WebP.",
        )
    ext = Path(file.filename or "logo.png").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".png"
    dojo_dir = UPLOAD_DIR / str(admin.dojo_id)
    dojo_dir.mkdir(parents=True, exist_ok=True)
    filename = f"logo_{uuid.uuid4().hex[:8]}{ext}"
    filepath = dojo_dir / filename
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo muito grande. Máximo 5MB.",
        )
    filepath.write_bytes(content)
    # Caminho relativo: o cliente monta a URL com seu baseURL (evita localhost no app mobile)
    logo_url = f"/static/uploads/dojos/{admin.dojo_id}/{filename}"
    dojo = await service.update_dojo(
        session, admin.dojo_id, schemas.DojoUpdate(logo_url=logo_url)
    )
    if dojo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dojo não encontrado")
    return schemas.DojoRead.model_validate(dojo)


@router.get("/", response_model=list[schemas.DojoRead])
async def list_dojos(
    _: SuperAdminDep,
    session: SessionDep,
) -> list[schemas.DojoRead]:
    dojos = await service.list_dojos(session)
    return [schemas.DojoRead.model_validate(dojo) for dojo in dojos]


@router.get("/{dojo_id}", response_model=schemas.DojoRead)
async def get_dojo(
    dojo_id: int,
    _: SuperAdminDep,
    session: SessionDep,
) -> schemas.DojoRead:
    dojo = await service.get_dojo(session, dojo_id)
    if dojo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dojo não encontrado")
    return schemas.DojoRead.model_validate(dojo)


@router.post("/", response_model=schemas.DojoRead, status_code=status.HTTP_201_CREATED)
async def create_dojo(
    payload: schemas.DojoCreate,
    _: SuperAdminDep,
    session: SessionDep,
) -> schemas.DojoRead:
    dojo = await service.create_dojo(session, payload)
    return schemas.DojoRead.model_validate(dojo)


@router.put("/{dojo_id}", response_model=schemas.DojoRead)
async def update_dojo(
    dojo_id: int,
    payload: schemas.DojoUpdate,
    _: SuperAdminDep,
    session: SessionDep,
) -> schemas.DojoRead:
    dojo = await service.update_dojo(session, dojo_id, payload)
    if dojo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dojo não encontrado")
    return schemas.DojoRead.model_validate(dojo)


@router.delete("/{dojo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dojo(
    dojo_id: int,
    _: SuperAdminDep,
    session: SessionDep,
) -> None:
    deleted = await service.delete_dojo(session, dojo_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dojo não encontrado")

