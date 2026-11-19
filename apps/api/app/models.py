"""Domain model: guardians, verified teachers, visits and what happens during a visit."""
import secrets
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)



class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(32), default=lambda: secrets.token_hex(16))
    role: Mapped[str] = mapped_column(String(16))  # guardian | teacher | admin
    name: Mapped[str] = mapped_column(String(40))
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id"))
    # guardian household
    region: Mapped[str] = mapped_column(String(60), default="강원특별자치도 춘천시 석사동")
    area: Mapped[str] = mapped_column(String(30), default="석사동")  # 동·읍·면
    lat: Mapped[float | None] = mapped_column(default=None)
    lng: Mapped[float | None] = mapped_column(default=None)
    address: Mapped[str] = mapped_column(String(120), default="춘천시 예시로 00")
    address_detail: Mapped[str] = mapped_column(String(80), default="가상동 101호")
    child_desc: Mapped[str] = mapped_column(String(60), default="초등 2학년 · 아이 한 명")


class Teacher(Base):
    __tablename__ = "teachers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(20))
    region: Mapped[str] = mapped_column(String(20))  # 춘천시, 원주시 ...
    area: Mapped[str] = mapped_column(String(30), default="")  # 석사동 (활동 중심 동네)
    lat: Mapped[float | None] = mapped_column(default=None)
    lng: Mapped[float | None] = mapped_column(default=None)
    radius_km: Mapped[float] = mapped_column(default=5.0)  # 방문 가능 반경
    # 선택 입력: 선생님의 관심사·삶의 경험. 보호자의 "추가 정보" 맥락 매칭에만 쓰임
    context: Mapped[str] = mapped_column(Text, default="")
    # certified = 교원 자격 보유(정교사 1·2급, 퇴직 교원 포함)
    # qualified = 준자격(보육교사·아이돌봄사·아동 교육 전공·아동 지도 경력 검증)
    qual_type: Mapped[str] = mapped_column(String(12))
    qual_detail: Mapped[str] = mapped_column(String(60))
    years: Mapped[int] = mapped_column(Integer, default=0)
    headline: Mapped[str] = mapped_column(String(40))  # 초등 저학년 지도
    title: Mapped[str] = mapped_column(String(60))  # 차분하게, 아이의 속도에 맞춰요
    intro: Mapped[str] = mapped_column(Text)
    experience: Mapped[list] = mapped_column(JSON, default=list)  # 차분한 설명 · 숙제 지도 경험
    tags: Mapped[list] = mapped_column(JSON, default=list)  # 매칭 태그
    days: Mapped[list] = mapped_column(JSON, default=list)  # 가능한 요일(월~일)
    start_time: Mapped[str] = mapped_column(String(5), default="15:00")
    rating: Mapped[float] = mapped_column(default=4.8)
    verified_docs: Mapped[bool] = mapped_column(Boolean, default=True)
    verified_crime: Mapped[bool] = mapped_column(Boolean, default=True)
    trained: Mapped[bool] = mapped_column(Boolean, default=True)
    shadow_visit: Mapped[bool] = mapped_column(Boolean, default=True)


class Visit(Base):
    __tablename__ = "visits"
    id: Mapped[int] = mapped_column(primary_key=True)
    guardian_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id"))
    date: Mapped[str] = mapped_column(String(10))  # 2026-11-20
    start: Mapped[str] = mapped_column(String(5))  # 15:00
    hours: Mapped[int] = mapped_column(Integer, default=3)
    kind: Mapped[str] = mapped_column(String(8), default="single")  # single | regular
    price: Mapped[int] = mapped_column(Integer, default=70000)
    note: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    # requested | declined | payment | booked | live | draft | sent | cancelled
    status: Mapped[str] = mapped_column(String(12), default="requested")
    consent_guardian: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_teacher: Mapped[bool] = mapped_column(Boolean, default=False)
    video_state: Mapped[str] = mapped_column(String(12), default="off")  # off | ready | live | stopped
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    teacher: Mapped[Teacher] = relationship()
    tasks: Mapped[list["Task"]] = relationship(order_by="Task.id", cascade="all, delete-orphan")


class Notice(Base):
    __tablename__ = "notices"
    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), index=True)
    title: Mapped[str] = mapped_column(String(80), default="가정통신문")
    source_text: Mapped[str] = mapped_column(Text)  # OCR 결과(원문). 선생님에게는 노출하지 않음
    items: Mapped[list] = mapped_column(JSON, default=list)
    engine: Mapped[str] = mapped_column(String(16), default="rules")
    status: Mapped[str] = mapped_column(String(12), default="review")  # review | approved
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), index=True)
    title: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(12), default="basic")  # basic | school
    owner: Mapped[str] = mapped_column(String(10), default="teacher")  # teacher | guardian
    category: Mapped[str] = mapped_column(String(12), default="")  # 준비물·제출물·납부 ...
    due: Mapped[str] = mapped_column(String(10), default="")
    done: Mapped[bool] = mapped_column(Boolean, default=False)


class ActivityRecord(Base):
    __tablename__ = "records"
    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), unique=True)
    homework: Mapped[int | None] = mapped_column(Integer)
    reading_min: Mapped[int | None] = mapped_column(Integer)
    memo: Mapped[str] = mapped_column(Text, default="")
    transcript: Mapped[str] = mapped_column(Text, default="")


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), unique=True)
    message: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    engine: Mapped[str] = mapped_column(String(16), default="rules")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
