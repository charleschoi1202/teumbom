"""설명 가능한 매칭 — 자연어 요구 → 태그 → 규칙 필터 → 가중 적합도 → 추천 사유.

The score is always computed by these rules (so it is explainable and stable);
Claude, when enabled, only helps turn free text into tags.
"""
from __future__ import annotations

from . import llm

# keyword → tag. Tags are what guardians see and can remove (S03-tags).
TAG_RULES: list[tuple[tuple[str, ...], str]] = [
    (("낯가", "낯을 가", "수줍", "내성적", "소심"), "낯가림"),
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

def _weekday(iso: str) -> str:
    from datetime import date

    try:
        return "월화수목금토일"[date.fromisoformat(iso).weekday()]
    except ValueError:
        return ""


QUAL_WEIGHT = {"certified": 1.0, "qualified": 0.88}
QUAL_LABEL = {"certified": "교원 자격 확인 완료", "qualified": "아동 지도 자격 확인 완료"}


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


def score(teacher, tags: list[str], region: str, day: str, start: str) -> tuple[int, list[str], bool]:
    """Return (score 0-100, reasons, available)."""
    t_tags = set(teacher.tags or [])
    want = set(tags)
    overlap = sorted(want & t_tags, key=tags.index) if want else []
    region_ok = teacher.region in (region or "")
    day_ok = not day or not teacher.days or _weekday(day) in teacher.days
    time_ok = not start or teacher.start_time <= start
    available = region_ok and day_ok and time_ok

    tag_part = (len(overlap) / max(len(want), 1)) * 40
    qual_part = 25 * QUAL_WEIGHT.get(teacher.qual_type, 0.8)
    exp_part = min(teacher.years, 30) / 30 * 15
    rating_part = max(0.0, (teacher.rating - 4.0)) / 1.0 * 10
    avail_part = 10 if available else 0
    total = int(round(tag_part + qual_part + exp_part + rating_part + avail_part))

    reasons: list[str] = []
    if "낯가림" in overlap:
        reasons.append("낯가림을 고려한 차분한 지도 경험")
    for tg in overlap:
        if tg == "낯가림":
            continue
        reasons.append(f"{tg} 경험")
        if len(reasons) >= 3:
            break
    if not reasons and teacher.experience:
        reasons.append(teacher.experience[0])
    if available:
        reasons.append(f"{teacher.region} · 요청한 시간 방문 가능")
    else:
        reasons.append("요청한 지역·시간과 일부 맞지 않음")
    return total, reasons, available


def recommend(teachers, tags: list[str], region: str, day: str, start: str, limit: int = 5) -> list[dict]:
    rows = []
    for t in teachers:
        s, reasons, available = score(t, tags, region, day, start)
        rows.append({"teacher": t, "score": s, "reasons": reasons, "available": available})
    rows.sort(key=lambda r: (r["available"], r["score"]), reverse=True)
    return rows[:limit]
