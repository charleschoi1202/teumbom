"""Seed data: a context-rich caregiver pool across 강원, operator review queue, demo rooms.

The pool is deliberately mixed: retired teachers sit next to a forest guide, a
beekeeper, a choir singer and a biology student. What matters for matching is
each person's story and what they love doing with children; credentials are
optional badges. Every caregiver still passes identity + criminal-record checks
and the platform's safety training before a first visit.
"""
from __future__ import annotations

import secrets
import string

from sqlalchemy import select
from sqlalchemy.orm import Session

from .ai import credential
from .models import CredentialReview, OpsAlert, Room, Teacher, User

WEEK = ["월", "화", "수", "목", "금"]

# name, region, background, qual_type, qual_detail, years_with_kids, headline, story, interests, traits, days, start, rating
POOL: list[tuple] = [
    ("김하늘", "춘천시", "퇴직 초등교사", "certified", "초등학교 정교사(2급)", 12, "숙제 습관 · 그림책 읽기",
     "초등학교 저학년 담임을 12년 했어요. 아이가 직접 해 볼 때까지 기다려 주는 걸 가장 중요하게 생각해요. 그림책을 소리 내어 같이 읽는 시간을 좋아해요.",
     ["책·이야기", "숙제·학습"], ["차분함", "다정함"], WEEK, "14:00", 4.9),
    ("한도윤", "춘천시", "숲해설가 · 은퇴", "none", "", 8, "숲 관찰 · 곤충과 식물 이야기",
     "공무원으로 일하다 은퇴하고 8년째 숲해설가로 활동하고 있어요. 아이들과 돋보기를 들고 개미와 나비, 나뭇잎을 관찰하는 시간을 제일 좋아해요. 비 오는 날엔 집에서 곤충 도감을 같이 그려요.",
     ["곤충", "식물·자연"], ["차분함", "다정함"], ["월", "수", "금"], "14:00", 4.9),
    ("정하은", "춘천시", "생명과학과 대학생", "none", "", 3, "곤충 채집 · 작은 과학 실험",
     "강원대 생명과학과 3학년이고 곤충 채집 동아리 회장이에요. 사슴벌레와 장수풍뎅이를 직접 키워 봐서 애벌레 이야기를 하면 아이들 눈이 반짝여요. 현미경으로 나뭇잎을 보는 실험도 준비해 가요.",
     ["곤충", "과학·실험"], ["활발함", "다정함"], ["화", "목", "금"], "15:00", 4.8),
    ("최민준", "춘천시", "시립합창단 출신", "none", "", 6, "노래 · 리듬 놀이",
     "춘천시립합창단에서 10년 노래했어요. 동요를 같이 부르고 컵과 냄비로 리듬 놀이를 하면 처음 보는 아이도 금방 웃어요. 우쿨렐레를 가져가서 아이가 좋아하는 노래를 반주해 줘요.",
     ["음악·노래"], ["활발함", "다정함"], ["월", "화", "수", "목"], "15:00", 4.8),
    ("이서윤", "춘천시", "보육교사 · 미술 놀이", "qualified", "보육교사 1급", 8, "그리기 · 만들기 놀이",
     "어린이집에서 8년 일했어요. 종이접기와 클레이로 아이가 오늘 본 것을 만들어 보는 활동을 자주 해요. 완성보다 만드는 과정을 칭찬해 주려고 해요.",
     ["미술·만들기", "춤·몸놀이"], ["다정함", "활발함"], WEEK, "13:00", 4.7),
    ("윤봄", "춘천시", "텃밭 농부 · 동네 요리 선생님", "none", "", 5, "텃밭 가꾸기 · 간단한 요리",
     "춘천 외곽에서 작은 텃밭 농사를 지어요. 상추 씨앗을 화분에 심고 물을 주는 일부터, 수확한 채소로 주먹밥 만드는 요리까지 아이와 함께해요.",
     ["식물·자연", "요리"], ["다정함", "차분함"], ["월", "수", "목"], "15:00", 4.8),
    ("강시우", "춘천시", "유소년 축구 코치", "none", "", 7, "바깥 놀이 · 공놀이",
     "주말엔 초등 유소년 축구팀 코치를 해요. 에너지가 넘치는 아이와 놀이터에서 공놀이, 줄넘기를 하고 들어와 숙제를 마무리하는 루틴을 잘 만들어요.",
     ["운동·바깥놀이"], ["활발함"], ["화", "목", "금"], "15:00", 4.7),
    ("서지아", "춘천시", "로봇 동호회 엔지니어", "none", "", 2, "레고 · 로봇 · 코딩 놀이",
     "공장 자동화 엔지니어로 일하다 육아휴직 중이에요. 레고로 움직이는 자동차를 만들고 간단한 블록 코딩으로 로봇을 움직여 보는 놀이를 해요.",
     ["레고·로봇", "코딩", "과학·실험"], ["차분함"], ["월", "수", "금"], "16:00", 4.6),
    ("문준서", "춘천시", "천문 동아리 · 공룡 덕후", "none", "", 2, "별자리 · 공룡 이야기",
     "대학 천문 동아리에서 망원경을 들고 별을 봤어요. 공룡 화석 모형 수집이 취미라 티라노사우루스 이야기를 시작하면 끝이 없어요.",
     ["우주·별", "공룡·화석"], ["다정함", "활발함"], ["화", "수", "목"], "15:00", 4.7),
    ("노윤아", "춘천시", "피아노 학원 은퇴 원장", "none", "", 20, "피아노 · 동요",
     "피아노 학원을 20년 운영하다 은퇴했어요. 악보를 몰라도 손가락으로 동요를 따라 치는 법부터 알려 줘요. 조용하고 낯가리는 아이들이 피아노 앞에서는 말이 많아지더라고요.",
     ["음악·노래"], ["차분함", "다정함"], WEEK, "14:00", 4.9),
    ("전다인", "춘천시", "식물 집사 · 플랜테리어", "none", "", 1, "식물 키우기",
     "집에서 식물 80개를 키우는 식물 집사예요. 아이와 같이 씨앗을 심고 새싹 관찰 일지를 쓰는 활동을 좋아해요.",
     ["식물·자연"], ["차분함"], ["월", "화", "금"], "15:00", 4.6),
    ("임채원", "춘천시", "아이돌봄사", "qualified", "아이돌봄사(국가자격)", 6, "생활 습관 · 간식 만들기",
     "아이돌봄사로 6년 활동했어요. 손 씻기와 가방 정리 같은 생활 습관을 놀이처럼 잡아 주고, 간단한 간식을 같이 만들어요.",
     ["요리", "숙제·학습"], ["다정함", "차분함"], WEEK, "13:00", 4.8),
    ("박다솜", "춘천시", "퇴직 초등교사", "certified", "초등학교 정교사(1급)", 28, "책 읽기 · 받아쓰기",
     "28년 교단에 있었고 학교 도서관 담당을 오래 했어요. 아이가 좋아하는 책을 함께 고르고 받아쓰기를 놀이처럼 해요.",
     ["책·이야기", "숙제·학습"], ["차분함"], ["화", "수", "목"], "14:00", 4.8),
    ("신유준", "원주시", "교감 퇴임", "certified", "초등학교 정교사(1급)", 34, "수학 · 보드게임",
     "교감으로 퇴임했어요. 숫자를 싫어하는 아이와 보드게임과 퍼즐로 수학 감각을 키우는 걸 좋아해요.",
     ["수학·퍼즐", "숙제·학습"], ["차분함"], WEEK, "14:00", 4.8),
    ("배나윤", "원주시", "곤충 체험관 해설사", "none", "", 10, "곤충 키우기 · 생태 관찰",
     "원주 곤충 체험관에서 10년 해설을 했어요. 집에서 키울 수 있는 곤충과 관찰 방법을 아이 눈높이로 알려 줘요.",
     ["곤충", "동물"], ["활발함", "다정함"], ["월", "수", "목", "금"], "15:00", 4.8),
    ("홍시우", "원주시", "음대 성악과 학생", "none", "", 2, "노래 · 발성 놀이",
     "연세대 미래캠퍼스 음악 동아리에서 성악을 해요. 아이가 좋아하는 만화 주제가를 함께 부르며 숨쉬기 놀이를 해요.",
     ["음악·노래"], ["활발함"], ["화", "목"], "16:00", 4.6),
    ("오예린", "원주시", "유아교육 전공 · 무용", "qualified", "유아교육 전공", 4, "율동 · 몸놀이",
     "유아교육을 전공했고 어릴 때부터 발레를 했어요. 동요에 맞춘 율동과 몸놀이로 아이의 에너지를 즐겁게 풀어 줘요.",
     ["춤·몸놀이", "음악·노래"], ["활발함", "다정함"], WEEK, "15:00", 4.7),
    ("조아린", "강릉시", "초등 영어교사", "certified", "초등학교 정교사(2급)", 6, "영어 동화 · 숙제",
     "초등 영어 전담교사로 일했어요. 영어 그림책을 소리 내어 읽고 노래로 단어를 익혀요.",
     ["영어·외국어", "책·이야기"], ["다정함"], WEEK, "15:00", 4.7),
    ("권하린", "강릉시", "해양 생물 연구 보조원", "none", "", 2, "바다 생물 · 관찰",
     "강릉 해양 연구소에서 연구 보조로 일해요. 조개껍데기와 바다 생물 사진으로 관찰 놀이를 해요.",
     ["동물", "과학·실험"], ["차분함"], ["월", "수"], "16:00", 4.6),
    ("황태윤", "강릉시", "제과제빵사", "none", "", 3, "쿠키 · 빵 만들기",
     "동네 빵집 제빵사예요. 아이와 쿠키 반죽을 만들며 숫자 세기와 기다리는 법을 같이 배워요.",
     ["요리", "수학·퍼즐"], ["다정함"], ["화", "목"], "15:00", 4.7),
    ("안소율", "속초시", "설악산 산악 가이드", "none", "", 5, "숲 산책 · 바깥 놀이",
     "설악산 가이드로 일해요. 집 근처 공원에서 나무 이름 맞히기와 숲 산책을 하며 체력과 관찰력을 키워요.",
     ["운동·바깥놀이", "식물·자연"], ["활발함"], ["월", "화", "금"], "15:00", 4.7),
    ("유가온", "홍천군", "양봉 농부", "none", "", 4, "꿀벌 · 텃밭 이야기",
     "홍천에서 꿀벌을 키우는 양봉 농부예요. 꿀벌이 꽃가루를 옮기는 이야기와 텃밭의 곤충 친구들을 아이와 관찰해요.",
     ["곤충", "식물·자연"], ["차분함", "다정함"], ["월", "수", "목"], "14:00", 4.8),
    ("남지호", "화천군", "퇴직 초등교사", "certified", "초등학교 정교사(1급)", 32, "숙제 · 자연 관찰",
     "화천에서 32년 아이들을 가르쳤어요. 작은 학교라 산과 냇가가 교실이었어요. 숙제를 마치고 냇가 생물 관찰을 같이 해요.",
     ["숙제·학습", "식물·자연"], ["차분함", "다정함"], WEEK, "14:00", 4.9),
    ("하로아", "화천군", "마을 합창단 지휘자", "none", "", 7, "노래 · 합창 놀이",
     "화천 마을 합창단을 7년째 지휘하고 있어요. 아이와 돌림노래를 부르며 차례를 기다리는 법을 연습해요.",
     ["음악·노래"], ["다정함"], ["화", "목", "금"], "15:00", 4.7),
    ("변서진", "양구군", "목공·도자기 공예가", "none", "", 3, "만들기 · 공예",
     "양구에서 공방을 운영해요. 나무 조각과 점토로 아이가 상상한 것을 직접 만들어 보게 해요.",
     ["미술·만들기"], ["차분함"], ["월", "수"], "15:00", 4.6),
    ("탁민서", "영월군", "박물관 해설사", "none", "", 6, "공룡 · 화석 이야기",
     "영월 박물관에서 해설을 해요. 공룡 화석 모형을 들고 가서 발굴 놀이를 해요.",
     ["공룡·화석", "책·이야기"], ["다정함"], ["화", "수", "목"], "15:00", 4.7),
    ("마시온", "평창군", "스키 강사", "none", "", 5, "몸놀이 · 바깥 놀이",
     "겨울엔 스키 강사, 그 외엔 아이들 체육 놀이를 해요. 균형 잡기 놀이와 공놀이로 몸을 쓰게 해요.",
     ["운동·바깥놀이"], ["활발함"], ["월", "화", "수"], "16:00", 4.6),
    ("주예준", "정선군", "컴퓨터공학과 학생", "none", "", 1, "코딩 · 수학 퍼즐",
     "컴퓨터공학을 공부해요. 블록 코딩으로 게임 만들기와 수학 퍼즐 풀기를 아이와 해요.",
     ["코딩", "수학·퍼즐"], ["차분함"], ["목", "금"], "16:00", 4.5),
    ("고은호", "횡성군", "동물병원 간호사", "none", "", 2, "동물 돌보기 이야기",
     "동물병원에서 일해요. 강아지와 고양이를 돌보는 이야기로 생명을 아끼는 마음을 나눠요.",
     ["동물"], ["다정함", "차분함"], ["월", "금"], "16:00", 4.6),
]

DEFAULT_TEACHER = "김하늘"


def _teacher(row: tuple, room_id: int | None = None, source_id: int | None = None) -> Teacher:
    (name, region, background, qual_type, qual_detail, years, headline, story, interests, traits, days, start, rating) = row
    return Teacher(
        room_id=room_id, source_id=source_id, name=name, region=region, background=background,
        story=story, interests=interests, traits=traits, qual_type=qual_type, qual_detail=qual_detail,
        years=years, headline=headline, title=headline, intro=story, experience=[background],
        tags=interests + traits, days=days, start_time=start, rating=rating,
        verified_docs=qual_type != "none",  # 자격 서류는 있는 경우에만 확인 대상
        verified_crime=True, trained=True, shadow_visit=True,
    )


def clone_for_room(db: Session, src: Teacher, room_id: int) -> Teacher:
    t = Teacher(room_id=room_id, source_id=src.id)
    for col in ("name", "region", "background", "story", "interests", "traits", "qual_type", "qual_detail", "years",
                "headline", "title", "intro", "experience", "tags", "days", "start_time", "rating",
                "verified_docs", "verified_crime", "trained", "shadow_visit"):
        setattr(t, col, getattr(src, col))
    db.add(t)
    db.flush()
    return t


REVIEWS = [
    ("이가람", "초등 교원 · 춘천시", "2026.11.19", "교원 자격증", "교원 자격증\n이름 이가람\n자격 초등학교 정교사(2급)\n발급 교육부장관"),
    ("박서연", "아이돌봄사 · 원주시", "2026.11.18", "아이돌봄사 자격증", "아이돌봄사 자격증\n성명: 박서연\n자격: 아이돌봄사\n경력: 7년 (지역아동센터)"),
    ("송이안", "경험 기반 · 숲해설 · 홍천군", "2026.11.18", "신원·범죄경력 확인서", "범죄경력 조회 회신서\n성명: 송이안\n조회 결과: 해당 없음\n활동 소개: 숲해설가 5년"),
]


def seed_base(db: Session) -> None:
    if db.scalar(select(Teacher).where(Teacher.room_id.is_(None)).limit(1)):
        return
    for row in POOL:
        db.add(_teacher(row))
    for name, applied, received, title, text in REVIEWS:
        db.add(CredentialReview(name=name, applied=applied, received=received, doc_title=title,
                                doc_text=text, extracted=credential.extract(text)))
    db.add(OpsAlert(
        room_id=None, kind="도착 지연", title="도착 지연", subtitle="11.20 (금) 15:00 · 한도윤 · 예정 방문",
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
    src = db.scalar(select(Teacher).where(Teacher.room_id.is_(None), Teacher.name == DEFAULT_TEACHER))
    teacher = clone_for_room(db, src, room.id)
    guardian = User(room_id=room.id, role="guardian", name="보호자")
    teacher_user = User(room_id=room.id, role="teacher", name=teacher.name, teacher_id=teacher.id)
    db.add_all([guardian, teacher_user])
    db.commit()
    return room, guardian, teacher_user
