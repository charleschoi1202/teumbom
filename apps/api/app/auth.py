import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .db import get_db
from .models import User

SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(32)
ALGO = "HS256"
RESET_MSG = "시연 데이터가 초기화됐어요. 처음부터 다시 시작해 주세요."


def issue(user: User) -> str:
    # The per-user random key is part of the token: after a demo DB reset user ids are reused,
    # so an old token must never resolve to someone else's account.
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "key": user.key,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def decode(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGO])
    except jwt.PyJWTError as e:
        raise HTTPException(401, RESET_MSG) from e


def resolve(db: Session, data: dict) -> User | None:
    user = db.get(User, int(data["sub"]))
    if not user or user.role != data.get("role") or user.key != data.get("key"):
        return None
    return user


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "로그인이 필요해요.")
    user = resolve(db, decode(authorization[7:]))
    if not user:
        raise HTTPException(401, RESET_MSG)
    return user


def require(role: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role != role:
            raise HTTPException(403, "이 역할로는 할 수 없어요.")
        return user

    return dep
