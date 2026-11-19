import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import auth
from .api import router
from .db import Base, SessionLocal, engine
from .models import Visit
from .realtime import channel_of, hub, visit_channels
from .seed import seed_base

logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_base(db)
    yield


app = FastAPI(title="틈봄 API", version="1.0.0", lifespan=lifespan)

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX") or None,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {"service": "teumbom-api", "ok": True}


app.include_router(router)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket, token: str = ""):
    try:
        data = auth.decode(token)
    except Exception:  # noqa: BLE001
        await ws.close(code=4401)
        return
    with SessionLocal() as db:
        user = auth.resolve(db, data)
    if not user:
        await ws.close(code=4401)
        return
    await ws.accept()
    me = channel_of(user)
    await hub.join(me, ws)
    try:
        while True:
            msg = json.loads(await ws.receive_text())
            if msg.get("type") == "rtc":
                with SessionLocal() as db:
                    v = db.get(Visit, int(msg.get("visit") or 0))
                if not v or me not in visit_channels(v):
                    continue  # only the two people of this visit can signal each other
                msg["from"] = user.role
                other = next(ch for ch in visit_channels(v) if ch != me)
                await hub.send(other, msg)
            elif msg.get("type") == "ping":
                await ws.send_text('{"type":"pong"}')
    except (WebSocketDisconnect, json.JSONDecodeError, RuntimeError, ValueError):
        pass
    finally:
        hub.leave(me, ws)
