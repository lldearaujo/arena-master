from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.modules.auth.routes import router as auth_router
from app.modules.dojos.routes import router as dojos_router
from app.modules.students.routes import router as students_router
from app.modules.superadmin.routes import router as superadmin_router
from app.modules.turmas.routes import router as turmas_router
from app.modules.check_in.routes import router as checkin_router
from app.modules.faixas.routes import router as faixas_router
from app.modules.users.routes import router as users_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Arena Master API",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        # Para desenvolvimento, liberamos as origens locais conhecidas.
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8081",   # Expo web
            "http://127.0.0.1:8081",
        ],
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

    @app.get("/health", tags=["health"])
    async def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()

