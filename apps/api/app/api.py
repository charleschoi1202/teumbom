from __future__ import annotations

import os
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import auth
from .ai import match as ai_match
from .ai import notice as ai_notice
from .ai import report as ai_report
from .ai import llm
from .db import get_db
from .models import ActivityRecord, Notice, Report, Room, Task, Teacher, User, Visit, now
from .realtime import hub
from .seed import clone_for_room, create_room

router = APIRouter(prefix="/api")
KST = timezone(timedelta(hours=9))
WEEK = "월화수목금토일"
ACTIVE = ("requested", "payment", "booked", "live", "draft")


# ───────────────────────────── helpers ─────────────────────────────
def date_label(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.month}월 {d.day}일 ({WEEK[d.weekday()]})"


def short_date(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.month}.{d.day:02d} ({WEEK[d.weekday()]})"


def end_time(start: str, hours: int) -> str:
    h, m = map(int, start.split(":"))
    return f"{(h + hours) % 24:02d}:{m:02d}"


def kst_hm(dt: datetime | None) -> str:
    if not dt:
        return ""
    if dt.tzinfo is None:  # SQLite drops tzinfo; we always store UTC
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).strftime("%H:%M")


def city(region: str) -> str:
    return region.split()[-1] if region else ""


QUAL_LABEL = {"certified": "교원 자격 확인 완료", "qualified": "아동 지도 자격 확인 완료"}
QUAL_KIND = {"certified": "교원 자격", "qualified": "준자격 · 경력 검증"}


def teacher_out(t: Teacher, score: int | None = None, reasons: list[str] | None = None, extra: dict | None = None) -> dict:
    return {
        "id": t.id, "name": t.name, "initial": t.name[:1], "region": t.region, "area": t.area,
        "radius_km": t.radius_km, "context": t.context,
        "qual_type": t.qual_type, "qual_label": QUAL_LABEL.get(t.qual_type, "자격 확인 완료"),
        "qual_kind": QUAL_KIND.get(t.qual_type, ""), "qual_detail": t.qual_detail, "years": t.years,
        "headline": t.headline, "title": t.title, "intro": t.intro, "experience": t.experience,
        "tags": t.tags, "days": t.days, "start_time": t.start_time, "rating": t.rating,
        "verified": {"docs": t.verified_docs, "crime": t.verified_crime, "training": t.trained, "shadow": t.shadow_visit},
        "score": score, "reasons": reasons or [],
        "distance_km": (extra or {}).get("distance_km"), "context_matched": (extra or {}).get("context_matched", []),
    }


def latest_notice(db: Session, visit_id: int) -> Notice | None:
    return db.scalar(select(Notice).where(Notice.visit_id == visit_id).order_by(Notice.id.desc()).limit(1))


def phase(v: Visit, n: Notice | None) -> str:
    if v.status == "booked" and n:
        return "approved" if n.status == "approved" else "reading"
    return v.status


def visit_out(db: Session, v: Visit, viewer: User) -> dict:
    guardian = db.get(User, v.guardian_id)
    n = latest_notice(db, v.id)
    rep = db.scalar(select(Report).where(Report.visit_id == v.id))
    rec = db.scalar(select(ActivityRecord).where(ActivityRecord.visit_id == v.id))
    is_teacher = viewer.role == "teacher"
    tasks = [t for t in v.tasks if not (is_teacher and t.owner == "guardian")]
    show_address = (not is_teacher) or v.status in ("booked", "live", "draft", "sent")
    notice_info = None
    if n:
        items = [i for i in n.items if i["status"] != "excluded"]
        notice_info = {
            "id": n.id, "status": n.status, "title": n.title,
            "teacher_count": sum(1 for i in items if i["owner"] == "teacher"),
            "guardian_count": sum(1 for i in items if i["owner"] == "guardian"),
        }
    return {
        "id": v.id, "date": v.date, "start": v.start, "hours": v.hours,
        "date_label": date_label(v.date), "short_date": short_date(v.date),
        "time_label": f"{v.start}–{end_time(v.start, v.hours)}",
        "kind": v.kind, "kind_label": "정기 방문" if v.kind == "regular" else "단발 방문",
        "price": v.price, "note": v.note, "tags": v.tags,
        "status": v.status, "phase": phase(v, n),
        "teacher": teacher_out(v.teacher), "simulated_teacher": v.teacher.room_id is None,
        "household": f"{guardian.area or city(guardian.region)} 보호자 가정" if guardian else "보호자 가정",
        "child_desc": guardian.child_desc if guardian else "",
        "region": guardian.region if guardian else "",
        "address": f"{guardian.address}, {guardian.address_detail}" if (guardian and show_address) else None,
        "consent": {"guardian": v.consent_guardian, "teacher": v.consent_teacher},
        "video_state": v.video_state,
        "started_at": kst_hm(v.started_at), "finished_at": kst_hm(v.finished_at),
        "tasks": [{"id": t.id, "title": t.title, "kind": t.kind, "owner": t.owner, "category": t.category,
                   "due": t.due, "due_label": (f"{date.fromisoformat(t.due).month}월 {date.fromisoformat(t.due).day}일" if t.due else ""),
                   "done": t.done} for t in tasks],
        "notice": notice_info,
        "record": {"homework": rec.homework, "reading_min": rec.reading_min, "memo": rec.memo} if rec else None,
        "report": ({"sent": bool(rep.sent_at), "sent_at": kst_hm(rep.sent_at), "message": rep.message if (rep.sent_at or is_teacher) else None}
                   if rep else None),
    }


def get_visit(db: Session, visit_id: int, user: User) -> Visit:
    v = db.get(Visit, visit_id)
    if not v or v.room_id != user.room_id:
        raise HTTPException(404, "방문을 찾을 수 없어요.")
    return v


def need_status(v: Visit, *allowed: str) -> None:
    if v.status not in allowed:
        raise HTTPException(409, "지금 상태에서는 할 수 없어요.")


def changed(v: Visit, what: str = "visit") -> None:
    hub.notify(v.room_id, what, v.id)


def ensure_basic_tasks(db: Session, v: Visit) -> None:
    if any(t.kind == "basic" for t in v.tasks):
        return
    for title in ("숙제 확인", "독서"):
        v.tasks.append(Task(title=title, kind="basic", owner="teacher"))



# ───────────────────────────── rooms & auth ─────────────────────────────
class JoinIn(BaseModel):
    role: str = "teacher"


@router.get("/config")
def config():
    ice = [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]
    if os.getenv("TURN_URL"):
        ice.append({"urls": os.getenv("TURN_URL").split(","), "username": os.getenv("TURN_USERNAME", ""),
                    "credential": os.getenv("TURN_CREDENTIAL", "")})
    return {"ice_servers": ice, "ai_engine": "claude" if llm.enabled() else "rules"}


@router.post("/rooms")
def new_room(db: Session = Depends(get_db)):
    room, guardian, _teacher = create_room(db)
    return {"code": room.code, "token": auth.issue(guardian), "role": "guardian"}


@router.post("/rooms/{code}/join")
def join_room(code: str, body: JoinIn, db: Session = Depends(get_db)):
    room = db.scalar(select(Room).where(Room.code == code.upper().strip()))
    if not room:
        raise HTTPException(404, "시연 방 코드를 다시 확인해 주세요.")
    if body.role not in ("teacher", "guardian"):
        raise HTTPException(400, "역할을 선택해 주세요.")
    user = db.scalar(select(User).where(User.room_id == room.id, User.role == body.role))
    return {"code": room.code, "token": auth.issue(user), "role": user.role}


@router.get("/me")
def me(user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    room = db.get(Room, user.room_id) if user.room_id else None
    teacher = db.get(Teacher, user.teacher_id) if user.teacher_id else None
    return {
        "id": user.id, "role": user.role, "name": user.name, "room": room.code if room else None,
        "peers": hub.peers(user.room_id) if user.room_id else [],
        "household": {"region": user.region, "area": user.area, "lat": user.lat, "lng": user.lng,
                      "address": user.address, "address_detail": user.address_detail, "child_desc": user.child_desc},
        "teacher": teacher_out(teacher) if teacher else None,
    }


class HouseholdIn(BaseModel):
    region: str = Field(min_length=2, max_length=60)
    address: str = Field(min_length=2, max_length=120)
    address_detail: str = Field(default="", max_length=80)
    area: str | None = Field(default=None, max_length=30)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)


@router.patch("/me/household")
def update_household(body: HouseholdIn, user: User = Depends(auth.require("guardian")), db: Session = Depends(get_db)):
    user.region, user.address, user.address_detail = body.region, body.address, body.address_detail
    if body.area:
        user.area = body.area
    if body.lat is not None and body.lng is not None:
        user.lat, user.lng = body.lat, body.lng
    db.commit()
    hub.notify(user.room_id, "household")
    return {"ok": True}


class TeacherProfileIn(BaseModel):
    name: str | None = Field(default=None, max_length=20)
    headline: str | None = Field(default=None, max_length=40)
    intro: str | None = Field(default=None, max_length=400)
    region: str | None = Field(default=None, max_length=20)
    days: list[str] | None = None
    start_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    context: str | None = Field(default=None, max_length=600)
    area: str | None = Field(default=None, max_length=30)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    radius_km: float | None = Field(default=None, ge=0.5, le=30)


@router.patch("/me/teacher")
def update_teacher(body: TeacherProfileIn, user: User = Depends(auth.require("teacher")), db: Session = Depends(get_db)):
    t = db.get(Teacher, user.teacher_id)
    for k, val in body.model_dump(exclude_none=True).items():
        setattr(t, k, val)
    if body.name:
        user.name = body.name
    db.commit()
    hub.notify(user.room_id, "teacher")
    return teacher_out(t)


# ───────────────────────────── matching ─────────────────────────────
class TagsIn(BaseModel):
    text: str = Field(default="", max_length=500)


@router.post("/match/tags")
def match_tags(body: TagsIn, user: User = Depends(auth.current_user)):
    return {"tags": ai_match.extract_tags(body.text), "engine": "claude+rules" if llm.enabled() else "rules"}


class RecommendIn(BaseModel):
    region: str = "강원특별자치도 춘천시 석사동"
    date: str
    start: str = "15:00"
    tags: list[str] = []
    lat: float | None = None
    lng: float | None = None
    context: str = Field(default="", max_length=500)  # 추가 정보(선택)


@router.post("/match/recommend")
def recommend(body: RecommendIn, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    pool = list(db.scalars(select(Teacher).where(Teacher.room_id.is_(None))))
    lat, lng = body.lat, body.lng
    if lat is None or lng is None:
        lat, lng = user.lat, user.lng
    rows = ai_match.recommend(pool, body.tags, body.date, body.start, lat, lng, body.region, body.context, limit=6)
    return {"teachers": [teacher_out(r["teacher"], r["score"], r["reasons"], r) for r in rows]}


@router.get("/teachers/{teacher_id}")
def teacher_detail(teacher_id: int, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    t = db.get(Teacher, teacher_id)
    if not t or (t.room_id not in (None, user.room_id)):
        raise HTTPException(404, "선생님을 찾을 수 없어요.")
    return teacher_out(t)


# ───────────────────────────── visits ─────────────────────────────
class VisitIn(BaseModel):
    teacher_id: int
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    start: str = Field(default="15:00", pattern=r"^\d{2}:\d{2}$")
    kind: str = Field(default="single", pattern="^(single|regular)$")
    note: str = Field(default="", max_length=300)
    tags: list[str] = []


@router.post("/visits")
def create_visit(body: VisitIn, user: User = Depends(auth.require("guardian")), db: Session = Depends(get_db)):
    src = db.get(Teacher, body.teacher_id)
    if not src or src.room_id not in (None, user.room_id):
        raise HTTPException(404, "선생님을 찾을 수 없어요.")
    t = src
    if src.room_id is None:
        # In a demo room the second phone becomes the teacher the guardian picked.
        t = db.scalar(select(Teacher).where(Teacher.room_id == user.room_id, Teacher.source_id == src.id))
        t = t or clone_for_room(db, src, user.room_id)
        teacher_user = db.scalar(select(User).where(User.room_id == user.room_id, User.role == "teacher"))
        if teacher_user:
            teacher_user.teacher_id, teacher_user.name = t.id, t.name
    v = Visit(room_id=user.room_id, guardian_id=user.id, teacher_id=t.id, date=body.date, start=body.start,
              kind=body.kind, price=60000 if body.kind == "regular" else 70000, note=body.note, tags=body.tags)
    db.add(v)
    db.commit()
    changed(v)
    return visit_out(db, v, user)


@router.get("/visits")
def list_visits(user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    q = select(Visit).where(Visit.room_id == user.room_id)
    visits = list(db.scalars(q.order_by(Visit.id.desc())))
    return {"visits": [visit_out(db, v, user) for v in visits]}


@router.get("/visits/{visit_id}")
def read_visit(visit_id: int, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    return visit_out(db, get_visit(db, visit_id, user), user)


@router.post("/visits/{visit_id}/accept")
def accept(visit_id: int, user: User = Depends(auth.require("teacher")), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    need_status(v, "requested")
    v.status = "payment"
    db.commit()
    changed(v)
    return visit_out(db, v, user)


@router.post("/visits/{visit_id}/decline")
def decline(visit_id: int, user: User = Depends(auth.require("teacher")), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    need_status(v, "requested")
    v.status = "declined"
    db.commit()
    changed(v)
    return visit_out(db, v, user)


@router.post("/visits/{visit_id}/pay")
def pay(visit_id: int, user: User = Depends(auth.require("guardian")), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    need_status(v, "payment")
    v.status = "booked"
    ensure_basic_tasks(db, v)
    db.commit()
    changed(v)
    return visit_out(db, v, user)


@router.post("/visits/{visit_id}/cancel")
def cancel(visit_id: int, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    need_status(v, "requested", "payment", "booked")
    v.status = "cancelled"
    db.commit()
    changed(v)
    return visit_out(db, v, user)


class ConsentIn(BaseModel):
    value: bool


@router.post("/visits/{visit_id}/consent")
def consent(visit_id: int, body: ConsentIn, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    if user.role == "guardian":
        v.consent_guardian = body.value
    else:
        v.consent_teacher = body.value
    if not body.value and v.video_state == "live":
        v.video_state = "stopped"
    db.commit()
    changed(v, "consent")
    return visit_out(db, v, user)


@router.post("/visits/{visit_id}/start")
def start(visit_id: int, user: User = Depends(auth.require("teacher")), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    need_status(v, "booked")
    v.status = "live"
    v.started_at = now()
    v.video_state = "ready" if (v.consent_guardian and v.consent_teacher) else "off"
    ensure_basic_tasks(db, v)
    db.commit()
    changed(v)
    return visit_out(db, v, user)


class VideoIn(BaseModel):
    state: str = Field(pattern="^(live|stopped|off)$")


@router.post("/visits/{visit_id}/video")
def video_state(visit_id: int, body: VideoIn, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    v.video_state = body.state
    db.commit()
    changed(v, "video")
    return {"video_state": v.video_state}


@router.post("/visits/{visit_id}/finish")
def finish(visit_id: int, user: User = Depends(auth.require("teacher")), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    need_status(v, "live")
    v.status = "draft"
    v.finished_at = now()
    v.video_state = "off"
    db.commit()
    changed(v)
    return visit_out(db, v, user)


class TaskIn(BaseModel):
    done: bool


@router.patch("/tasks/{task_id}")
def update_task(task_id: int, body: TaskIn, user: User = Depends(auth.require("teacher")), db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "할 일을 찾을 수 없어요.")
    v = get_visit(db, t.visit_id, user)
    need_status(v, "live", "draft")
    if t.owner != "teacher":
        raise HTTPException(403, "보호자 할 일이에요.")
    t.done = body.done
    db.commit()
    changed(v, "task")
    return {"id": t.id, "done": t.done}


# ───────────────────────────── record & report ─────────────────────────────
class RecordIn(BaseModel):
    homework: int | None = Field(default=None, ge=0, le=50)
    reading_min: int | None = Field(default=None, ge=0, le=300)
    memo: str = Field(default="", max_length=600)
    transcript: str = Field(default="", max_length=2000)


@router.put("/visits/{visit_id}/record")
def save_record(visit_id: int, body: RecordIn, user: User = Depends(auth.require("teacher")), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    need_status(v, "live", "draft")
    rec = db.scalar(select(ActivityRecord).where(ActivityRecord.visit_id == v.id)) or ActivityRecord(visit_id=v.id)
    rec.homework, rec.reading_min, rec.memo = body.homework, body.reading_min, body.memo
    if body.transcript:
        rec.transcript = body.transcript
    db.add(rec)
    db.commit()
    changed(v, "record")
    return {"ok": True}


@router.post("/visits/{visit_id}/report/draft")
def report_draft(visit_id: int, user: User = Depends(auth.require("teacher")), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    need_status(v, "draft", "sent")
    rec = db.scalar(select(ActivityRecord).where(ActivityRecord.visit_id == v.id))
    f = ai_report.facts(v.tasks, rec.homework if rec else None, rec.reading_min if rec else None, rec.memo if rec else "")
    rep = db.scalar(select(Report).where(Report.visit_id == v.id))
    if rep and rep.sent_at:
        return {"activity": ai_report.activity_lines(rep.summary), "message": rep.message, "sent": True, "sent_at": kst_hm(rep.sent_at)}
    message = ai_report.draft(f)
    rep = rep or Report(visit_id=v.id)
    rep.summary, rep.message, rep.engine = f, message, "claude+rules" if llm.enabled() else "rules"
    db.add(rep)
    db.commit()
    return {"activity": ai_report.activity_lines(f), "message": message, "sent": False}


class SendIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    confirmed: bool


@router.post("/visits/{visit_id}/report/send")
def report_send(visit_id: int, body: SendIn, user: User = Depends(auth.require("teacher")), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    need_status(v, "draft")
    if not body.confirmed:
        raise HTTPException(400, "활동 기록과 대조한 뒤 보낼 수 있어요.")
    rep = db.scalar(select(Report).where(Report.visit_id == v.id))
    if not rep:
        raise HTTPException(409, "리포트 초안을 먼저 만들어 주세요.")
    rep.message, rep.sent_at = body.message.strip(), now()
    v.status = "sent"
    db.commit()
    changed(v, "report")
    return {"sent_at": kst_hm(rep.sent_at)}


def report_out(db: Session, v: Visit) -> dict | None:
    rep = db.scalar(select(Report).where(Report.visit_id == v.id))
    if not rep or not rep.sent_at:
        return None
    f = rep.summary or {}
    return {
        "visit_id": v.id, "date_label": date_label(v.date), "short_date": short_date(v.date),
        "time_label": f"{v.start}–{end_time(v.start, v.hours)}", "teacher": v.teacher.name,
        "sent_at": kst_hm(rep.sent_at), "message": rep.message, "read": rep.read,
        "homework": f.get("homework"), "reading_min": f.get("reading_min"),
        "school_done": f.get("school_done", []), "activity": ai_report.activity_lines(f) if f else [],
    }


@router.get("/reports")
def reports(user: User = Depends(auth.require("guardian")), db: Session = Depends(get_db)):
    visits = list(db.scalars(select(Visit).where(Visit.room_id == user.room_id, Visit.status == "sent").order_by(Visit.date.desc())))
    items = [r for r in (report_out(db, v) for v in visits) if r]
    week_reading = sum(r["reading_min"] or 0 for r in items)
    return {"reports": items, "week": {"reading_min": week_reading, "visits": len(items)}}


@router.get("/visits/{visit_id}/report")
def read_report(visit_id: int, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    r = report_out(db, v)
    if not r:
        raise HTTPException(404, "아직 보낸 리포트가 없어요.")
    if user.role == "guardian":
        rep = db.scalar(select(Report).where(Report.visit_id == v.id))
        if not rep.read:
            rep.read = True
            db.commit()
    return r


# ───────────────────────────── notices (알림장 챙김) ─────────────────────────────
class NoticeIn(BaseModel):
    text: str = Field(min_length=5, max_length=8000)


def notice_out(n: Notice, viewer: User) -> dict:
    if viewer.role == "teacher":  # 원문은 선생님에게 비노출
        raise HTTPException(403, "통신문 원문은 보호자만 볼 수 있어요.")
    items = n.items
    pending = [i for i in items if i["status"] == "pending"]
    sendable = [i for i in items if i["owner"] == "teacher" and i["status"] in ("verified", "edited")]
    return {"id": n.id, "visit_id": n.visit_id, "title": n.title, "status": n.status, "engine": n.engine,
            "source_text": n.source_text, "items": items, "pending": len(pending), "send_count": len(sendable)}


@router.post("/visits/{visit_id}/notices")
def upload_notice(visit_id: int, body: NoticeIn, user: User = Depends(auth.require("guardian")), db: Session = Depends(get_db)):
    v = get_visit(db, visit_id, user)
    need_status(v, "booked", "payment", "requested")
    result = ai_notice.extract(body.text, v.date)
    n = Notice(visit_id=v.id, title=result["title"], source_text=body.text, items=result["items"], engine=result["engine"])
    db.add(n)
    db.commit()
    changed(v, "notice")
    return notice_out(n, user)


@router.get("/notices/{notice_id}")
def read_notice(notice_id: int, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    n = db.get(Notice, notice_id)
    if not n:
        raise HTTPException(404, "통신문을 찾을 수 없어요.")
    get_visit(db, n.visit_id, user)
    return notice_out(n, user)


class ItemIn(BaseModel):
    action: str = Field(pattern="^(verify|exclude|include|edit)$")
    due: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    title: str | None = Field(default=None, max_length=80)


@router.patch("/notices/{notice_id}/items/{idx}")
def update_item(notice_id: int, idx: int, body: ItemIn, user: User = Depends(auth.require("guardian")), db: Session = Depends(get_db)):
    n = db.get(Notice, notice_id)
    if not n:
        raise HTTPException(404, "통신문을 찾을 수 없어요.")
    v = get_visit(db, n.visit_id, user)
    if n.status == "approved":
        raise HTTPException(409, "이미 전달한 통신문이에요.")
    items = [dict(i) for i in n.items]
    it = next((i for i in items if i["id"] == idx), None)
    if not it:
        raise HTTPException(404, "항목을 찾을 수 없어요.")
    if body.action == "verify":
        it["status"] = "verified"
    elif body.action == "exclude":
        it["status"] = "excluded"
    elif body.action == "include":
        it["status"] = "pending" if it["warning"] else "verified"
    elif body.action == "edit":
        if body.due:
            d = date.fromisoformat(body.due)
            it["due"], it["due_label"] = body.due, f"{d.month}월 {d.day}일"
            if it["category"] not in ("준비물", "제출물"):
                it["detail"] = f"{it['category']} · {it['due_label']}까지"
        if body.title:
            it["title"] = body.title
        it["status"] = "edited"
    n.items = items
    db.commit()
    changed(v, "notice")
    return notice_out(n, user)


@router.post("/notices/{notice_id}/approve")
def approve_notice(notice_id: int, user: User = Depends(auth.require("guardian")), db: Session = Depends(get_db)):
    n = db.get(Notice, notice_id)
    if not n:
        raise HTTPException(404, "통신문을 찾을 수 없어요.")
    v = get_visit(db, n.visit_id, user)
    if any(i["status"] == "pending" for i in n.items):
        raise HTTPException(409, "날짜를 확인하거나 해당 항목을 제외해 주세요.")
    for i in n.items:
        if i["status"] == "excluded" or i["category"] == "행사":
            continue
        v.tasks.append(Task(title=i["title"], kind="school", owner=i["owner"], category=i["category"], due=i["due"]))
    n.status = "approved"
    db.commit()
    changed(v, "notice")
    return visit_out(db, v, user)
