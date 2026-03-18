from functools import lru_cache

from pydantic import Field
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = Field("development", alias="APP_ENV")

    backend_host: str = Field("0.0.0.0", alias="BACKEND_HOST")
    backend_port: int = Field(8000, alias="BACKEND_PORT")

    database_url: str = Field(..., alias="DATABASE_URL")

    jwt_secret: str = Field(..., alias="JWT_SECRET")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expires_minutes: int = Field(
        30, alias="JWT_ACCESS_TOKEN_EXPIRES_MINUTES"
    )
    jwt_refresh_token_expires_days: int = Field(
        7, alias="JWT_REFRESH_TOKEN_EXPIRES_DAYS"
    )

    # Lista de origens permitidas para CORS. Para simplificar o carregamento via .env,
    # usamos uma lista simples de strings e um valor padrão vazio.
    cors_origins: list[str] = Field(default_factory=list, alias="CORS_ORIGINS")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        # Aceita:
        # - lista nativa (ex.: JSON) -> ["https://a.com", "https://b.com"]
        # - string separada por vírgula -> "https://a.com,https://b.com"
        if v is None:
            return []
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        if isinstance(v, str):
            raw = v.strip()
            if not raw:
                return []
            return [item.strip() for item in raw.split(",") if item.strip()]
        return v

    class Config:
        # Em produção normalmente as variáveis vêm do ambiente, mas também aceitamos
        # `.env.production` quando existir no diretório de execução.
        env_file = (".env", ".env.production")
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

