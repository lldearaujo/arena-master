"""Envio opcional via FCM (API legada HTTP). Sem chave configurada, não faz nada."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def send_fcm_notification_if_configured(device_token: str, title: str, body: str) -> bool:
    settings = get_settings()
    key = getattr(settings, "fcm_server_key", None)
    if not key or not device_token:
        return False
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
            "Authorization": f"key={key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 300
    except urllib.error.URLError as e:
        logger.warning("FCM send failed: %s", e)
        return False
