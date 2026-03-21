from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_models() -> None:
    """Cria as tabelas no banco se ainda não existirem.

    Isso é útil em desenvolvimento quando ainda não temos migrações
    configuradas para os novos models.
    """
    # Import das models aqui para garantir que todas foram registradas em Base.metadata
    from app import models as _models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # create_all não altera tabelas já existentes; colunas novas precisam de DDL explícito.
        if "postgres" in settings.database_url.lower():
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT")
            )
            # create_all não adiciona colunas novas a competition_matches já existente
            await conn.execute(
                text(
                    """
                    ALTER TABLE competition_matches
                    ADD COLUMN IF NOT EXISTS feeder_red_match_id INTEGER
                    REFERENCES competition_matches(id) ON DELETE SET NULL
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE competition_matches
                    ADD COLUMN IF NOT EXISTS feeder_blue_match_id INTEGER
                    REFERENCES competition_matches(id) ON DELETE SET NULL
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE competition_weight_classes
                    ADD COLUMN IF NOT EXISTS modality VARCHAR(8) NOT NULL DEFAULT 'gi'
                    """
                )
            )
            await conn.execute(
                text("ALTER TABLE students ALTER COLUMN dojo_id DROP NOT NULL")
            )
            await conn.execute(
                text(
                    "ALTER TABLE students ADD COLUMN IF NOT EXISTS external_dojo_name VARCHAR(255)"
                )
            )
            await conn.execute(
                text(
                    "ALTER TABLE students ADD COLUMN IF NOT EXISTS external_faixa_label VARCHAR(255)"
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE competition_registrations
                    ADD COLUMN IF NOT EXISTS declared_weight_kg DOUBLE PRECISION
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE competitions
                    ADD COLUMN IF NOT EXISTS registration_fee_amount DOUBLE PRECISION
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE competitions
                    ADD COLUMN IF NOT EXISTS registration_payment_instructions TEXT
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE competition_registrations
                    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) NOT NULL DEFAULT 'not_applicable'
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE competition_registrations
                    ADD COLUMN IF NOT EXISTS payment_receipt_path VARCHAR(512)
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE competition_registrations
                    ADD COLUMN IF NOT EXISTS payment_notes TEXT
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE competition_registrations
                    ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    ALTER TABLE competitions
                    ADD COLUMN IF NOT EXISTS banner_url VARCHAR(512)
                    """
                )
            )


