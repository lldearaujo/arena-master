"""Envio opcional via FCM.

Preferencialmente usa FCM HTTP v1 (OAuth2 via service account). Se não estiver configurado,
faz fallback para o endpoint legado (FCM_SERVER_KEY) para compatibilidade.
"""

from __future__ import annotations

import json
import json
import logging
import time
import urllib.error
import urllib.request
from typing import Any

from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_TOKEN_CACHE: dict[str, Any] = {"access_token": None, "expires_at": 0.0}


def _get_fcm_v1_access_token(service_account_info: dict[str, Any]) -> str:
    # Cache simples em memória para reduzir overhead por request.
    now = time.time()
    token = _TOKEN_CACHE.get("access_token")
    expires_at = float(_TOKEN_CACHE.get("expires_at") or 0.0)
    if token and now < (expires_at - 60):
        return str(token)

    creds = service_account.Credentials.from_service_account_info(
        service_account_info,
        scopes=["https://www.googleapis.com/auth/firebase.messaging"],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("FCM v1: credenciais sem token")

    _TOKEN_CACHE["access_token"] = creds.token
    # google-auth expõe expiry como datetime; pode ser None em cenários extremos.
    if getattr(creds, "expiry", None) is not None:
        _TOKEN_CACHE["expires_at"] = float(creds.expiry.timestamp())
    else:
        _TOKEN_CACHE["expires_at"] = now + 3000
    return str(creds.token)


def _load_service_account_info(settings) -> dict[str, Any] | None:
    if settings.fcm_service_account_json:
        try:
            return json.loads(settings.fcm_service_account_json)
        except json.JSONDecodeError:
            logger.warning("FCM_SERVICE_ACCOUNT_JSON inválido (não é JSON).")
            return None
    if settings.fcm_service_account_file:
        try:
            with open(settings.fcm_service_account_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except OSError as e:
            logger.warning("FCM_SERVICE_ACCOUNT_FILE não acessível: %s", e)
            return None
        except json.JSONDecodeError:
            logger.warning("FCM_SERVICE_ACCOUNT_FILE inválido (não é JSON).")
            return None
    return None


def _send_fcm_v1(project_id: str, service_account_info: dict[str, Any], device_token: str, title: str, body: str) -> bool:
    access_token = _get_fcm_v1_access_token(service_account_info)
    payload = json.dumps(
        {
            "message": {
                "token": device_token,
                "notification": {"title": title, "body": body},
                "android": {"priority": "HIGH"},
            }
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
        data=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as e:
        # Tenta ler o body de erro (útil para diagnosticar config/credenciais).
        err_body = None
        try:
            err_body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        logger.warning("FCM v1 send failed: %s body=%s", e, err_body)
        return False
    except urllib.error.URLError as e:
        logger.warning("FCM v1 send failed: %s", e)
        return False


def _send_fcm_legacy(server_key: str, device_token: str, title: str, body: str) -> bool:
    payload = json.dumps(
        {
            "to": device_token,
            "notification": {"title": title, "body": body},
            "priority": "high",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://fcm.googleapis.com/fcm/send",
        data=payload,
        headers={
            "Authorization": f"key={server_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 300
    except urllib.error.URLError as e:
        logger.warning("FCM legacy send failed: %s", e)
        return False


def send_fcm_notification_if_configured(device_token: str, title: str, body: str) -> bool:
    settings = get_settings()
    if not device_token:
        return False

    # Prioridade: FCM HTTP v1 (service account) -> legado (server key)
    if settings.fcm_project_id:
        sa_info = _load_service_account_info(settings)
        if sa_info:
            return _send_fcm_v1(settings.fcm_project_id, sa_info, device_token, title, body)

    if settings.fcm_server_key:
        return _send_fcm_legacy(settings.fcm_server_key, device_token, title, body)

    return False
