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


def issue(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "room": user.room_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def decode(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGO])
    except jwt.PyJWTError as e:
        raise HTTPException(401, "다시 시작해 주세요.") from e


def current_user(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "로그인이 필요해요.")
    data = decode(authorization[7:])
    user = db.get(User, int(data["sub"]))
    if not user:
        raise HTTPException(401, "시연 방이 초기화됐어요. 다시 시작해 주세요.")
    return user


def require(role: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role != role:
            raise HTTPException(403, "이 역할로는 할 수 없어요.")
        return user

    return dep
