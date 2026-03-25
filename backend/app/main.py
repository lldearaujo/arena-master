from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.core.config import get_settings
from app.core.database import init_models
from app.modules.auth.routes import router as auth_router
from app.modules.dojos.routes import router as dojos_router
from app.modules.students.routes import router as students_router
from app.modules.superadmin.routes import router as superadmin_router
from app.modules.turmas.routes import router as turmas_router
from app.modules.check_in.routes import router as checkin_router
from app.modules.faixas.routes import router as faixas_router
from app.modules.users.routes import router as users_router
from app.modules.mural.routes import router as mural_router
from app.modules.finance.routes import router as finance_router
from app.modules.skills.routes import router as skills_router
from app.modules.matriculas.routes import router as matriculas_router
from app.modules.modalidades.routes import router as modalidades_router
from app.modules.competitions.routes import router as competitions_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Arena Master API",
        version="0.1.0",
    )

    # Em produção estamos atrás de um reverse proxy (EasyPanel) que termina TLS.
    # Precisamos respeitar X-Forwarded-Proto/For para que redirects (ex.: barra final)
    # não "desçam" para http:// e gerem Mixed Content no navegador.
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

    dev_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081",  # Expo web (comum)
        "http://127.0.0.1:8081",
        "http://localhost:19006",  # Expo web (porta alternativa)
        "http://127.0.0.1:19006",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
    ]
    extra_origins = settings.cors_origins or []
    allow_origins = list(dict.fromkeys([*dev_origins, *extra_origins]))

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
    app.include_router(dojos_router, prefix="/api/dojos", tags=["dojos"])
    app.include_router(superadmin_router, prefix="/api/superadmin", tags=["superadmin"])
    app.include_router(students_router, prefix="/api/students", tags=["students"])
    app.include_router(turmas_router, prefix="/api/turmas", tags=["turmas"])
    app.include_router(checkin_router, prefix="/api/check-in", tags=["check-in"])
    app.include_router(faixas_router, prefix="/api/faixas", tags=["faixas"])
    app.include_router(users_router, prefix="/api/users", tags=["users"])
    app.include_router(mural_router, prefix="/api/mural", tags=["mural"])
    app.include_router(finance_router, prefix="/api/finance", tags=["finance"])
    app.include_router(skills_router, prefix="/api/skills", tags=["skills"])
    app.include_router(matriculas_router, prefix="/api/matriculas", tags=["matriculas"])
    app.include_router(competitions_router, prefix="/api/competitions", tags=["competitions"])
    app.include_router(modalidades_router, prefix="/api/modalidades", tags=["modalidades"])

    # Diretório de arquivos estáticos (inclui comprovantes em static/receipts e logos de dojos)
    # Usamos o diretório "static" dentro de backend/, compartilhado entre os módulos Python.
    # Estrutura esperada:
    #   <project_root>/
    #       backend/
    #           app/
    #           static/
    #               receipts/
    #               uploads/dojos/
    static_dir = Path(__file__).resolve().parents[2] / "static"
    static_dir.mkdir(exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    @app.on_event("startup")
    async def on_startup() -> None:
        # Em desenvolvimento, garante que novas tabelas (como as de finanças)
        # sejam criadas automaticamente se ainda não existirem.
        await init_models()

    @app.get("/health", tags=["health"])
    async def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()

