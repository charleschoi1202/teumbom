"""Seed data: verified teacher pool across 강원 at 동(neighbourhood) level, demo rooms.

Every teacher is verified exactly as in the original design (교원 자격 or 준자격,
범죄경력, 표준 교육). On top of that each teacher has a short `context` — their
interests and life experience — used only by the optional "추가 정보" matching.
"""
from __future__ import annotations

import secrets
import string

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Room, Teacher, User

WEEK = ["월", "화", "수", "목", "금"]

# name, city, area(동), lat, lng, qual_type, qual_detail, years, headline, tags, days, start, rating, context
POOL: list[tuple] = [
    ("김하늘", "춘천시", "석사동", 37.8531, 127.7489, "certified", "초등학교 정교사(2급) · 초등 담임 12년", 12, "초등 저학년 지도",
     ["낯가림", "숙제 지도", "독서", "차분한 지도", "수학", "학교 준비물", "생활 습관"], WEEK, "14:00", 4.9,
     "주말마다 숲 해설 자원봉사를 해요. 아이들과 돋보기로 개미와 나비, 나뭇잎을 관찰하는 걸 좋아해요."),
    ("박다솜", "춘천시", "퇴계동", 37.8556, 127.7317, "certified", "초등학교 정교사(1급) · 퇴직 교원", 28, "독서 활동 · 생활 지도",
     ["독서", "생활 습관", "숙제 지도", "한글·받아쓰기"], ["화", "수", "목", "금"], "14:00", 4.8,
     "성당 성가대에서 20년 노래했어요. 피아노 반주로 동요를 함께 부르면 아이들이 금방 마음을 열어요."),
    ("이서윤", "춘천시", "후평동", 37.8803, 127.7468, "qualified", "보육교사 1급 · 방과후 돌봄 8년", 8, "놀이형 학습 · 저학년 돌봄",
     ["놀이형 지도", "활동적인 아이", "숙제 지도", "미술"], WEEK, "13:00", 4.7,
     "그림 그리기와 종이접기, 클레이 만들기를 좋아해요. 아이가 오늘 본 것을 함께 만들어 봐요."),
    ("최민준", "춘천시", "효자동", 37.8693, 127.7375, "certified", "초등학교 정교사(2급) · 임용 준비", 2, "수학 · 숙제 지도",
     ["수학", "숙제 지도", "집중력"], ["월", "화", "수", "목"], "15:00", 4.7,
     "생명과학을 부전공했고 사슴벌레와 장수풍뎅이를 직접 키워요. 곤충 이야기를 하면 아이들 눈이 반짝여요."),
    ("정하은", "춘천시", "온의동", 37.8617, 127.7211, "qualified", "아동학 전공 · 아동 지도 경력 5년", 5, "독서 · 한글 지도",
     ["독서", "한글·받아쓰기", "낯가림"], ["월", "수", "금"], "15:00", 4.8,
     "시립도서관에서 그림책 낭독 봉사를 해요. 이야기를 지어 내고 역할극을 하는 걸 좋아해요."),
    ("한지우", "춘천시", "우두동", 37.8963, 127.7262, "qualified", "아이돌봄사(국가자격) · 초등 돌봄 6년", 6, "생활 습관 · 안전 돌봄",
     ["생활 습관", "학교 준비물", "차분한 지도"], WEEK, "14:00", 4.8,
     "작은 텃밭을 가꿔요. 아이와 상추 씨앗을 심고 물 주기, 수확한 채소로 주먹밥 만들기를 해요."),
    ("강하린", "춘천시", "근화동", 37.8822, 127.7172, "certified", "초등학교 정교사(2급)", 5, "숙제 · 바깥 놀이",
     ["숙제 지도", "활동적인 아이", "놀이형 지도"], ["화", "목", "금"], "15:00", 4.7,
     "주말엔 유소년 축구 코치를 해요. 놀이터에서 공놀이와 줄넘기를 하고 숙제를 마무리하는 루틴을 만들어요."),
    ("윤봄", "춘천시", "소양동", 37.8849, 127.7296, "qualified", "유아교육 전공 · 방문 돌봄 4년", 4, "놀이 · 독서",
     ["놀이형 지도", "독서", "낯가림"], ["월", "화", "수"], "15:00", 4.7,
     "대학 천문 동아리에서 망원경으로 별을 봤어요. 별자리와 우주 이야기, 공룡 화석 모형 놀이를 좋아해요."),
    ("조은솔", "춘천시", "교동", 37.8789, 127.7361, "certified", "초등학교 정교사(1급) · 퇴직 교원", 30, "숙제 · 생활 지도",
     ["숙제 지도", "생활 습관", "차분한 지도"], WEEK, "14:00", 4.8,
     "피아노 학원을 함께 운영했어요. 조용한 아이도 피아노 앞에서는 말이 많아져요. 노래와 리듬 놀이를 해요."),
    ("서지아", "춘천시", "칠전동", 37.8372, 127.7283, "qualified", "보육교사 2급 · 방과후 강사 5년", 5, "놀이 · 미술",
     ["미술", "놀이형 지도", "활동적인 아이"], ["월", "수", "금"], "16:00", 4.6,
     "레고 로봇 동아리 강사를 했어요. 블록으로 움직이는 자동차를 만들고 간단한 코딩 놀이를 해요."),
    ("윤서아", "원주시", "무실동", 37.3335, 127.9301, "certified", "초등학교 정교사(1급) · 퇴직 교원", 31, "숙제 · 독서 지도",
     ["숙제 지도", "독서", "차분한 지도", "낯가림"], WEEK, "14:00", 4.8,
     "곤충 체험관에서 해설 봉사를 해요. 집에서 키울 수 있는 곤충과 관찰 방법을 알려 줘요."),
    ("강도윤", "원주시", "단구동", 37.3268, 127.9512, "certified", "초등학교 정교사(2급)", 4, "수학 · 놀이 학습",
     ["수학", "놀이형 지도", "활동적인 아이"], ["화", "수", "목"], "15:00", 4.7,
     "보드게임과 퍼즐을 좋아해요. 숫자를 싫어하는 아이와 게임으로 수 감각을 키워요."),
    ("임채원", "원주시", "명륜동", 37.3381, 127.9418, "qualified", "보육교사 2급 · 지역아동센터 7년", 7, "저학년 생활 지도",
     ["생활 습관", "숙제 지도", "미술"], WEEK, "13:00", 4.7,
     "제과제빵 자격이 있어 아이와 쿠키 반죽을 만들며 기다리는 법을 같이 배워요."),
    ("오예린", "원주시", "반곡동", 37.3205, 127.9790, "qualified", "유아교육 전공 · 방문 돌봄 4년", 4, "놀이 · 독서",
     ["놀이형 지도", "독서", "낯가림"], ["월", "수", "목"], "15:00", 4.6,
     "어릴 때부터 발레를 했어요. 동요에 맞춘 율동과 몸놀이로 아이의 에너지를 즐겁게 풀어 줘요."),
    ("조아린", "강릉시", "교동", 37.7638, 128.8958, "certified", "초등학교 정교사(2급)", 6, "영어 · 숙제 지도",
     ["영어", "숙제 지도", "독서"], WEEK, "15:00", 4.7,
     "해양 생물을 좋아해 바닷가에서 조개껍데기를 모아요. 영어 그림책과 바다 생물 이야기를 함께해요."),
    ("홍시우", "강릉시", "포남동", 37.7672, 128.9104, "qualified", "아이돌봄사(국가자격)", 9, "안전 돌봄 · 생활 습관",
     ["생활 습관", "차분한 지도", "학교 준비물"], ["화", "목"], "15:00", 4.7,
     "마을 합창단에서 노래해요. 돌림노래를 부르며 차례를 기다리는 법을 연습해요."),
    ("유가온", "홍천군", "홍천읍", 37.6971, 127.8887, "certified", "초등학교 정교사(1급) · 퇴직 교원", 27, "독서 · 숙제",
     ["독서", "숙제 지도", "낯가림"], ["월", "수", "목"], "14:00", 4.8,
     "꿀벌을 키우는 양봉을 해요. 꿀벌이 꽃가루를 옮기는 이야기와 텃밭 곤충 관찰을 해요."),
    ("남지호", "화천군", "화천읍", 38.1061, 127.7082, "certified", "초등학교 정교사(1급) · 퇴직 교원", 32, "학교 적응 · 생활 지도",
     ["생활 습관", "학교 준비물", "낯가림"], WEEK, "14:00", 4.9,
     "작은 학교에서 산과 냇가를 교실 삼아 가르쳤어요. 숙제를 마치고 냇가 생물을 관찰해요."),
]

DEFAULT_TEACHER = "김하늘"

# Default household location for a new demo room until the guardian shares their location
DEFAULT_HOME = dict(region="강원특별자치도 춘천시 석사동", area="석사동", lat=37.8519, lng=127.7468)


def _teacher(row: tuple) -> Teacher:
    (name, city, area, lat, lng, qual_type, qual_detail, years, headline, tags, days, start, rating, context) = row
    return Teacher(
        room_id=None, name=name, region=city, area=area, lat=lat, lng=lng, radius_km=5.0,
        qual_type=qual_type, qual_detail=qual_detail, years=years, headline=headline,
        title="차분하게, 아이의 속도에 맞춰요" if name == DEFAULT_TEACHER else "아이의 하루를 차근차근 함께해요",
        intro=(
            "초등 저학년의 숙제 확인과 독서 활동을 지도해요. 아이가 직접 해 볼 수 있도록 기다리고 함께 확인합니다."
            if name == DEFAULT_TEACHER else f"{headline}을 중심으로 아이가 스스로 해 볼 수 있도록 돕습니다."
        ),
        experience=["차분한 설명 · 숙제 지도 경험", "요청한 지역과 시간에 방문 가능"] if name == DEFAULT_TEACHER
        else [f"{' · '.join(tags[:2])} 경험"],
        tags=tags, days=days, start_time=start, rating=rating, context=context,
    )


def clone_for_room(db: Session, src: Teacher, room_id: int) -> Teacher:
    t = Teacher(room_id=room_id, source_id=src.id)
    for col in ("name", "region", "area", "lat", "lng", "radius_km", "qual_type", "qual_detail", "years", "headline",
                "title", "intro", "experience", "tags", "days", "start_time", "rating", "context",
                "verified_docs", "verified_crime", "trained", "shadow_visit"):
        setattr(t, col, getattr(src, col))
    db.add(t)
    db.flush()
    return t


def seed_base(db: Session) -> None:
    if db.scalar(select(Teacher).where(Teacher.room_id.is_(None)).limit(1)):
        return
    for row in POOL:
        db.add(_teacher(row))
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
    src = db.scalar(select(Teacher).where(Teacher.room_id.is_(None), Teacher.name == DEFAULT_TEACHER))
    teacher = clone_for_room(db, src, room.id)
    guardian = User(room_id=room.id, role="guardian", name="보호자", **DEFAULT_HOME)
    teacher_user = User(room_id=room.id, role="teacher", name=teacher.name, teacher_id=teacher.id)
    db.add_all([guardian, teacher_user])
    db.commit()
    return room, guardian, teacher_user
