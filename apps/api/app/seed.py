"""Seed data: a verified teacher pool across 강원, operator review queue, and demo rooms."""
from __future__ import annotations

import random
import secrets
import string

from sqlalchemy import select
from sqlalchemy.orm import Session

from .ai import credential
from .models import CredentialReview, OpsAlert, Room, Teacher, User

# 김하늘 is the live teacher in every demo room; the rest form the shared pool.
KIM_HANEUL = dict(
    name="김하늘",
    region="춘천시",
    qual_type="certified",
    qual_detail="초등학교 정교사(2급) · 초등 담임 12년",
    years=12,
    headline="초등 저학년 지도",
    title="차분하게, 아이의 속도에 맞춰요",
    intro="초등 저학년의 숙제 확인과 독서 활동을 지도해요. 아이가 직접 해 볼 수 있도록 기다리고 함께 확인합니다.",
    experience=["차분한 설명 · 숙제 지도 경험", "요청한 지역과 시간에 방문 가능"],
    tags=["낯가림", "숙제 지도", "독서", "차분한 지도", "수학", "학교 준비물", "생활 습관"],
    days=["월", "화", "수", "목", "금"],
    start_time="14:00",
    rating=4.9,
)

POOL = [
    # name, region, qual_type, qual_detail, years, headline, tags
    ("박다솜", "춘천시", "certified", "초등학교 정교사(1급) · 퇴직 교원", 28, "독서 활동 · 생활 지도", ["독서", "생활 습관", "숙제 지도", "한글·받아쓰기"]),
    ("이서윤", "춘천시", "qualified", "보육교사 1급 · 방과후 돌봄 8년", 8, "놀이형 학습 · 저학년 돌봄", ["놀이형 지도", "활동적인 아이", "숙제 지도", "미술"]),
    ("최민준", "춘천시", "certified", "초등학교 정교사(2급) · 임용 준비", 2, "수학 · 숙제 지도", ["수학", "숙제 지도", "집중력"]),
    ("정하은", "춘천시", "qualified", "아동학 전공 · 아동 지도 경력 5년", 5, "독서 · 한글 지도", ["독서", "한글·받아쓰기", "낯가림"]),
    ("한지우", "춘천시", "qualified", "아이돌봄사(국가자격) · 초등 돌봄 6년", 6, "생활 습관 · 안전 돌봄", ["생활 습관", "학교 준비물", "차분한 지도"]),
    ("윤서아", "원주시", "certified", "초등학교 정교사(1급) · 퇴직 교원", 31, "숙제 · 독서 지도", ["숙제 지도", "독서", "차분한 지도", "낯가림"]),
    ("강도윤", "원주시", "certified", "초등학교 정교사(2급)", 4, "수학 · 놀이 학습", ["수학", "놀이형 지도", "활동적인 아이"]),
    ("임채원", "원주시", "qualified", "보육교사 2급 · 지역아동센터 7년", 7, "저학년 생활 지도", ["생활 습관", "숙제 지도", "미술"]),
    ("오예린", "원주시", "qualified", "유아교육 전공 · 방문 돌봄 4년", 4, "놀이 · 독서", ["놀이형 지도", "독서", "낯가림"]),
    ("신유준", "원주시", "certified", "초등학교 정교사(1급) · 교감 퇴임", 34, "학습 습관 · 숙제", ["숙제 지도", "집중력", "생활 습관"]),
    ("조아린", "강릉시", "certified", "초등학교 정교사(2급)", 6, "영어 · 숙제 지도", ["영어", "숙제 지도", "독서"]),
    ("홍시우", "강릉시", "qualified", "아이돌봄사(국가자격)", 9, "안전 돌봄 · 생활 습관", ["생활 습관", "차분한 지도", "학교 준비물"]),
    ("배나윤", "강릉시", "certified", "유치원 정교사(1급) · 퇴직 교원", 26, "저학년 적응 · 한글", ["한글·받아쓰기", "낯가림", "독서"]),
    ("문준서", "속초시", "certified", "초등학교 정교사(1급) · 퇴직 교원", 29, "수학 · 학습 지도", ["수학", "숙제 지도", "집중력"]),
    ("서지아", "속초시", "qualified", "아동가족 전공 · 아동 지도 6년", 6, "놀이 · 미술", ["미술", "놀이형 지도", "활동적인 아이"]),
    ("권하린", "동해시", "certified", "초등학교 정교사(2급)", 3, "독서 · 글쓰기", ["독서", "한글·받아쓰기", "숙제 지도"]),
    ("황태윤", "동해시", "qualified", "보육교사 1급 · 돌봄교실 10년", 10, "저학년 돌봄", ["생활 습관", "숙제 지도", "학교 준비물"]),
    ("안소율", "삼척시", "certified", "초등학교 정교사(1급) · 퇴직 교원", 30, "숙제 · 생활 지도", ["숙제 지도", "생활 습관", "차분한 지도"]),
    ("송이안", "삼척시", "qualified", "아이돌봄사(국가자격)", 5, "안전 돌봄 · 놀이", ["놀이형 지도", "생활 습관"]),
    ("유가온", "홍천군", "certified", "초등학교 정교사(1급) · 퇴직 교원", 27, "독서 · 숙제", ["독서", "숙제 지도", "낯가림"]),
    ("전다인", "홍천군", "qualified", "초등교육 전공 · 아동 지도 3년", 3, "수학 · 놀이", ["수학", "놀이형 지도"]),
    ("고은호", "횡성군", "certified", "초등학교 정교사(2급) · 임용 준비", 2, "숙제 · 독서", ["숙제 지도", "독서"]),
    ("남지호", "화천군", "certified", "초등학교 정교사(1급) · 퇴직 교원", 32, "학교 적응 · 생활 지도", ["생활 습관", "학교 준비물", "낯가림"]),
    ("하로아", "화천군", "qualified", "아이돌봄사(국가자격) · 군 지역 돌봄 7년", 7, "안전 돌봄", ["생활 습관", "차분한 지도"]),
    ("변서진", "양구군", "certified", "중등학교 정교사(2급) · 수학", 5, "수학 · 숙제 지도", ["수학", "숙제 지도", "집중력"]),
    ("노윤아", "인제군", "qualified", "보육교사 1급 · 돌봄 6년", 6, "놀이 · 생활", ["놀이형 지도", "생활 습관"]),
    ("탁민서", "영월군", "certified", "초등학교 정교사(1급) · 퇴직 교원", 25, "독서 · 한글", ["독서", "한글·받아쓰기", "차분한 지도"]),
    ("마시온", "평창군", "qualified", "아동학 전공 · 방과후 강사 5년", 5, "미술 · 놀이", ["미술", "놀이형 지도", "활동적인 아이"]),
    ("주예준", "정선군", "certified", "초등학교 정교사(2급)", 4, "숙제 · 수학", ["숙제 지도", "수학"]),
]


def _pool_teacher(row: tuple, rng: random.Random) -> Teacher:
    name, region, qtype, qdetail, years, headline, tags = row
    days = sorted(rng.sample(["월", "화", "수", "목", "금"], k=rng.randint(3, 5)), key="월화수목금".index)
    return Teacher(
        room_id=None,
        name=name,
        region=region,
        qual_type=qtype,
        qual_detail=qdetail,
        years=years,
        headline=headline,
        title="아이의 하루를 차근차근 함께해요",
        intro=f"{headline}을 중심으로 아이가 스스로 해 볼 수 있도록 돕습니다.",
        experience=[f"{' · '.join(tags[:2])} 경험"],
        tags=tags,
        days=days,
        start_time=rng.choice(["13:00", "14:00", "15:00"]),
        rating=round(rng.uniform(4.5, 4.9), 1),
    )


REVIEWS = [
    ("이가람", "초등 교원 · 춘천시", "2026.11.19", "교원 자격증", "교원 자격증\n이름 이가람\n자격 초등학교 정교사(2급)\n발급 교육부장관"),
    ("박서연", "준자격 · 원주시", "2026.11.18", "보육교사 자격증", "보육교사 자격증\n성명: 박서연\n자격: 보육교사 1급\n경력: 7년 (지역아동센터)"),
]


def seed_base(db: Session) -> None:
    if db.scalar(select(Teacher).where(Teacher.room_id.is_(None)).limit(1)):
        return
    rng = random.Random(7)
    for row in POOL:
        db.add(_pool_teacher(row, rng))
    for name, applied, received, title, text in REVIEWS:
        db.add(CredentialReview(name=name, applied=applied, received=received, doc_title=title,
                                doc_text=text, extracted=credential.extract(text)))
    db.add(OpsAlert(
        room_id=None, kind="도착 지연", title="도착 지연", subtitle="11.20 (금) 15:00 · 김하늘 · 예정 방문",
        detail=["예정 시작 15:00", "선생님 도착 확인 15:08"], status="open",
    ))
    db.commit()


def new_room_code(db: Session) -> str:
    alphabet = string.ascii_uppercase.replace("O", "").replace("I", "") + "23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(6))
        if not db.scalar(select(Room).where(Room.code == code)):
            return code


def create_room(db: Session) -> tuple[Room, User, User]:
    room = Room(code=new_room_code(db))
    db.add(room)
    db.flush()
    teacher = Teacher(room_id=room.id, **KIM_HANEUL)
    db.add(teacher)
    db.flush()
    guardian = User(room_id=room.id, role="guardian", name="보호자")
    teacher_user = User(room_id=room.id, role="teacher", name=teacher.name, teacher_id=teacher.id)
    db.add_all([guardian, teacher_user])
    db.commit()
    return room, guardian, teacher_user
