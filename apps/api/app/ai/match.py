"""설명 가능한 매칭 — 자연어 요구 → 태그 → 규칙 필터 → 가중 적합도 → 추천 사유.

Base matching is unchanged from the original design (자격·태그·경력·평점·가능 시간),
with availability now decided by real distance from the guardian's neighbourhood.

One addition: if the guardian writes optional "추가 정보" (e.g. "곤충이랑 식물을
좋아해요"), we also look for teachers whose own interests/experience (`context`)
fit that context, add a bounded bonus, and quote the matching sentence as a reason.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from datetime import date

from . import llm

# keyword → tag. Tags are what guardians see and can remove (S03-tags).
TAG_RULES: list[tuple[tuple[str, ...], str]] = [
    (("낯", "수줍", "내성적", "소심"), "낯가림"),
    (("숙제", "과제", "학습지"), "숙제 지도"),
    (("독서", "책", "읽기", "동화"), "독서"),
    (("수학", "연산", "계산", "구구단"), "수학"),
    (("받아쓰기", "한글", "맞춤법", "글쓰기"), "한글·받아쓰기"),
    (("영어", "알파벳", "파닉스"), "영어"),
    (("놀이", "재미", "즐겁"), "놀이형 지도"),
    (("차분", "천천히", "조용"), "차분한 지도"),
    (("활발", "에너지", "산만", "뛰어", "운동"), "활동적인 아이"),
    (("집중", "주의"), "집중력"),
    (("생활 습관", "정리", "습관", "스스로"), "생활 습관"),
    (("준비물", "알림장", "가정통신문"), "학교 준비물"),
    (("미술", "그림", "만들기"), "미술"),
]

# Context themes for the optional "추가 정보" field
THEMES: dict[str, tuple[str, ...]] = {
    "곤충": ("곤충", "벌레", "개미", "나비", "딱정벌레", "사슴벌레", "장수풍뎅이", "잠자리", "채집", "꿀벌", "양봉", "애벌레"),
    "식물·자연": ("식물", "꽃", "나무", "텃밭", "씨앗", "화분", "숲", "자연", "정원", "나뭇잎", "산책", "냇가", "채소"),
    "동물": ("동물", "강아지", "고양이", "새", "물고기", "바다 생물", "조개", "생물"),
    "음악·노래": ("노래", "음악", "피아노", "악기", "합창", "성가대", "동요", "리듬", "반주"),
    "춤·몸놀이": ("춤", "댄스", "율동", "발레", "몸놀이"),
    "미술·만들기": ("그림", "미술", "색칠", "만들기", "종이접기", "클레이", "그리기"),
    "과학·실험": ("과학", "실험", "관찰", "현미경", "생명과학"),
    "우주·별": ("우주", "별", "별자리", "행성", "천문", "망원경"),
    "공룡": ("공룡", "화석"),
    "운동·바깥놀이": ("운동", "축구", "줄넘기", "공놀이", "놀이터", "바깥", "뛰어"),
    "요리": ("요리", "쿠키", "빵", "주먹밥", "제과", "반죽", "간식"),
    "책·이야기": ("그림책", "낭독", "이야기", "역할극", "도서관"),
    "레고·로봇": ("레고", "블록", "로봇", "코딩"),
    "수학·퍼즐": ("보드게임", "퍼즐", "숫자", "수 감각"),
    "영어": ("영어", "외국어"),
}

QUAL_WEIGHT = {"certified": 1.0, "qualified": 0.88}
QUAL_LABEL = {"certified": "교원 자격 확인 완료", "qualified": "아동 지도 자격 확인 완료"}


def _weekday(iso: str) -> str:
    try:
        return "월화수목금토일"[date.fromisoformat(iso).weekday()]
    except ValueError:
        return ""


def extract_tags(text: str) -> list[str]:
    text = text or ""
    tags = [tag for keys, tag in TAG_RULES if any(k in text for k in keys)]
    if llm.enabled() and text.strip():
        data = llm.complete_json(
            "Map a Korean parent's request for an after-school teacher to tags. "
            "Only use tags from this list: " + ", ".join(t for _, t in TAG_RULES) + ". "
            'Return JSON {"tags": [..]}.',
            text,
            max_tokens=800,
        )
        if isinstance(data, dict):
            allowed = {t for _, t in TAG_RULES}
            tags += [t for t in data.get("tags", []) if t in allowed and t not in tags]
    return tags or ["숙제 지도"]


def context_themes(text: str) -> list[str]:
    return [th for th, words in THEMES.items() if any(w in (text or "") for w in words)]


def distance_km(lat1, lng1, lat2, lng2) -> float | None:
    if None in (lat1, lng1, lat2, lng2):
        return None
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _bigrams(text: str) -> Counter:
    s = re.sub(r"[^가-힣a-zA-Z0-9]", "", text or "")
    return Counter(s[i:i + 2] for i in range(len(s) - 1))


def _cosine(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    dot = sum(v * b.get(k, 0) for k, v in a.items())
    return dot / (math.sqrt(sum(v * v for v in a.values())) * math.sqrt(sum(v * v for v in b.values())))


def context_fit(context_text: str, teacher) -> tuple[float, str | None, list[str]]:
    """How well the guardian's extra context fits the teacher's own experience (0–1), plus quoted evidence."""
    if not (context_text or "").strip() or not (teacher.context or "").strip():
        return 0.0, None, []
    want = context_themes(context_text)
    have = context_themes(teacher.context)
    matched = [th for th in want if th in have]
    theme_part = len(matched) / len(want) if want else 0.0
    sim = _cosine(_bigrams(context_text), _bigrams(teacher.context))
    fit = min(1.0, 0.75 * theme_part + 1.2 * sim)
    evidence = None
    if matched:
        words = THEMES[matched[0]]
        for sent in re.split(r"(?<=[.!?요다])\s+", teacher.context):
            if any(w in sent for w in words):
                evidence = sent.strip()
                break
    return fit, evidence, matched


def score(teacher, tags: list[str], day: str, start: str, dist: float | None, region_text: str = "",
          context_text: str = "") -> tuple[int, list[str], bool, dict]:
    """Return (score 0-99, reasons, available, extra)."""
    t_tags = set(teacher.tags or [])
    want = set(tags)
    overlap = sorted(want & t_tags, key=tags.index) if want else []
    near = (dist <= teacher.radius_km) if dist is not None else (teacher.region in (region_text or ""))
    day_ok = not day or not teacher.days or _weekday(day) in teacher.days
    time_ok = not start or teacher.start_time <= start
    available = near and day_ok and time_ok

    tag_part = (len(overlap) / max(len(want), 1)) * 40
    qual_part = 25 * QUAL_WEIGHT.get(teacher.qual_type, 0.8)
    exp_part = min(teacher.years, 30) / 30 * 15
    rating_part = max(0.0, (teacher.rating - 4.0)) / 1.0 * 10
    avail_part = 10 if available else 0
    base = tag_part + qual_part + exp_part + rating_part + avail_part

    fit, evidence, ctx_matched = context_fit(context_text, teacher)
    total = base * 0.85 + fit * 15 if (context_text or "").strip() else base
    total = int(round(min(99, total)))

    reasons: list[str] = []
    if ctx_matched and evidence:
        reasons.append(f"추가 정보와 맞아요 · {', '.join(ctx_matched)} — “{evidence}”")
    if "낯가림" in overlap:
        reasons.append("낯가림을 고려한 차분한 지도 경험")
    for tg in overlap:
        if tg == "낯가림":
            continue
        reasons.append(f"{tg} 경험")
        if len(reasons) >= 3:
            break
    if not overlap and teacher.experience:
        reasons.append(teacher.experience[0])
    where = f"{teacher.area} · {dist:.1f}km" if dist is not None else teacher.region
    reasons.append(f"{where} · 요청한 시간 방문 가능" if available else f"{where} · 요청한 지역·시간과 일부 맞지 않음")
    return total, reasons, available, {"distance_km": round(dist, 1) if dist is not None else None,
                                       "context_matched": ctx_matched, "context_fit": round(fit, 2)}


def recommend(teachers, tags: list[str], day: str, start: str, lat: float | None, lng: float | None,
              region_text: str = "", context_text: str = "", limit: int = 6) -> list[dict]:
    rows = []
    for t in teachers:
        dist = distance_km(lat, lng, t.lat, t.lng)
        s, reasons, available, extra = score(t, tags, day, start, dist, region_text, context_text)
        rows.append({"teacher": t, "score": s, "reasons": reasons, "available": available, **extra})
    rows.sort(key=lambda r: (r["available"], r["score"], -(r["distance_km"] or 0)), reverse=True)
    return rows[:limit]
