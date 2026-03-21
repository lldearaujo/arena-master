"""WebSocket fan-out por competição (placar / fila)."""

from __future__ import annotations

import json
from typing import Any

from fastapi import WebSocket


class CompetitionWebSocketHub:
    def __init__(self) -> None:
        self._connections: dict[int, list[WebSocket]] = {}

    async def connect(self, competition_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(competition_id, []).append(websocket)

    def disconnect(self, competition_id: int, websocket: WebSocket) -> None:
        conns = self._connections.get(competition_id)
        if not conns:
            return
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            del self._connections[competition_id]

    async def broadcast(self, competition_id: int, message: dict[str, Any]) -> None:
        conns = list(self._connections.get(competition_id, []))
        dead: list[WebSocket] = []
        raw = json.dumps(message, default=str)
        for ws in conns:
            try:
                await ws.send_text(raw)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(competition_id, ws)


competition_ws_hub = CompetitionWebSocketHub()
