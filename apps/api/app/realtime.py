"""Per-room WebSocket hub: state-change pushes + WebRTC signaling relay.

Single-process by design (Render free plan runs one instance). Messages:
  server → client  {"type": "changed", "what": "visit"|"notice"|"report"|..., "visit_id": int}
  client ↔ client  {"type": "rtc", "kind": "offer"|"answer"|"ice"|"hello"|"bye", ...} relayed to the other role
"""
from __future__ import annotations

import asyncio
import json
from collections import defaultdict

from fastapi import WebSocket


class Hub:
    def __init__(self) -> None:
        self.rooms: dict[int, dict[WebSocket, str]] = defaultdict(dict)
        self.loop: asyncio.AbstractEventLoop | None = None

    async def join(self, room_id: int, ws: WebSocket, role: str) -> None:
        self.loop = asyncio.get_running_loop()
        self.rooms[room_id][ws] = role

    def leave(self, room_id: int, ws: WebSocket) -> None:
        self.rooms.get(room_id, {}).pop(ws, None)

    def peers(self, room_id: int) -> list[str]:
        return sorted(set(self.rooms.get(room_id, {}).values()))

    async def send(self, room_id: int, message: dict, *, skip: WebSocket | None = None, role: str | None = None) -> None:
        text = json.dumps(message, ensure_ascii=False)
        for ws, r in list(self.rooms.get(room_id, {}).items()):
            if ws is skip or (role and r != role):
                continue
            try:
                await ws.send_text(text)
            except Exception:  # noqa: BLE001 - a dead socket must not break the broadcast
                self.leave(room_id, ws)

    def notify(self, room_id: int | None, what: str, visit_id: int | None = None) -> None:
        """Fire-and-forget from sync request handlers."""
        if room_id is None or self.loop is None:
            return
        msg = {"type": "changed", "what": what, "visit_id": visit_id}
        try:
            asyncio.run_coroutine_threadsafe(self.send(room_id, msg), self.loop)
        except RuntimeError:
            pass


hub = Hub()
