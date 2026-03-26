from functools import lru_cache

from pathlib import Path
from pydantic import Field
from pydantic import field_validator
from pydantic_settings import BaseSettings


_THIS_FILE = Path(__file__).resolve()
# backend/app/core/config.py -> backend/ (parents[2]) -> repo root (parents[3])
_BACKEND_ROOT = _THIS_FILE.parents[2]
_REPO_ROOT = _THIS_FILE.parents[3]


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

    # Opcional: chave servidor FCM (legada) para push ao app. Sem isso, notificações ficam só no banco.
    fcm_server_key: str | None = Field(None, alias="FCM_SERVER_KEY")

    # Recomendado: FCM HTTP v1 (OAuth2 via Service Account)
    # - FCM_PROJECT_ID: id do projeto Firebase/Google Cloud (ex.: "arena-master-4c0ea")
    # - FCM_SERVICE_ACCOUNT_FILE: caminho para o JSON da service account
    # - FCM_SERVICE_ACCOUNT_JSON: conteúdo JSON (string) da service account (alternativa ao file)
    fcm_project_id: str | None = Field(None, alias="FCM_PROJECT_ID")
    fcm_service_account_file: str | None = Field(None, alias="FCM_SERVICE_ACCOUNT_FILE")
    fcm_service_account_json: str | None = Field(None, alias="FCM_SERVICE_ACCOUNT_JSON")

    # Webhook n8n: ensinamento diário do Bushido (por usuário)
    bushido_webhook_url: str = Field(
        "https://n8n.ideiasobria.online/webhook/consulta-bushido",
        alias="BUSHIDO_WEBHOOK_URL",
    )
    bushido_webhook_method: str = Field("POST", alias="BUSHIDO_WEBHOOK_METHOD")

    @field_validator("bushido_webhook_method", mode="before")
    @classmethod
    def _normalize_bushido_method(cls, v):
        raw = (str(v or "").strip().upper()) or "POST"
        if raw not in {"POST", "GET"}:
            return "POST"
        return raw

    @field_validator("bushido_webhook_url", mode="before")
    @classmethod
    def _normalize_bushido_url(cls, v):
        raw = (str(v or "").strip() if v is not None else "").strip()
        if not raw:
            return raw
        if raw.startswith("https://.") or raw.startswith("http://."):
            return raw
        if raw.startswith("http://") or raw.startswith("https://"):
            return raw
        # Permite usuário setar "n8n.ideiasobria.online/..." sem scheme
        return f"https://{raw}"

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
        # Em produção normalmente as variáveis vêm do ambiente. Ainda assim, para
        # facilitar deploys simples, tentamos carregar `.env`/`.env.production`
        # tanto na raiz do repositório quanto em `backend/`, sem depender do cwd.
        env_file = (
            str(_REPO_ROOT / ".env"),
            str(_BACKEND_ROOT / ".env"),
        )
        env_file_encoding = "utf-8"
        case_sensitive = False
        # Permite que `.env`/`.env.production` contenham variáveis extras (ex.: do web)
        # sem quebrar o backend.
        extra = "ignore"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

