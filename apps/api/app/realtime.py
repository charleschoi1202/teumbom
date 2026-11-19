"""WebSocket hub: state-change pushes + WebRTC signaling relay between the two people of a visit.

Channels: "g{guardian_user_id}" for a guardian, "t{teacher_id}" for a teacher.
  server → client  {"type": "changed", "what": ..., "visit_id": int}
  client → server  {"type": "rtc", "visit": id, ...} relayed to the other party of that visit
Single-process by design (Render free plan runs one instance).
"""
from __future__ import annotations

import asyncio
import json
from collections import defaultdict

from fastapi import WebSocket


class Hub:
    def __init__(self) -> None:
        self.channels: dict[str, set[WebSocket]] = defaultdict(set)
        self.loop: asyncio.AbstractEventLoop | None = None

    async def join(self, channel: str, ws: WebSocket) -> None:
        self.loop = asyncio.get_running_loop()
        self.channels[channel].add(ws)

    def leave(self, channel: str, ws: WebSocket) -> None:
        self.channels.get(channel, set()).discard(ws)

    def online(self, channel: str) -> bool:
        return bool(self.channels.get(channel))

    async def send(self, channel: str, message: dict, *, skip: WebSocket | None = None) -> None:
        text = json.dumps(message, ensure_ascii=False)
        for ws in list(self.channels.get(channel, ())):
            if ws is skip:
                continue
            try:
                await ws.send_text(text)
            except Exception:  # noqa: BLE001 - a dead socket must not break the broadcast
                self.leave(channel, ws)

    def notify(self, channels: list[str], what: str, visit_id: int | None = None) -> None:
        """Fire-and-forget from sync request handlers."""
        if self.loop is None:
            return
        msg = {"type": "changed", "what": what, "visit_id": visit_id}
        for ch in channels:
            try:
                asyncio.run_coroutine_threadsafe(self.send(ch, msg), self.loop)
            except RuntimeError:
                pass


hub = Hub()


def channel_of(user) -> str:
    return f"g{user.id}" if user.role == "guardian" else f"t{user.teacher_id}"


def visit_channels(v) -> list[str]:
    return [f"g{v.guardian_id}", f"t{v.teacher_id}"]
