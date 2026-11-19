"""맥락 기반 매칭 — 아이가 좋아하는 것과 돌봄 선생님의 삶의 이야기를 잇는다.

No fixed rule like "must hold a teaching licence". Anyone from a neighbour with a
lifelong hobby to a retired teacher can be the right match, depending on the child.

  보호자의 자연어 ─► 테마·성향 추출 ─┐
                                      ├─► 테마 겹침(55) + 이야기 문맥 유사도(20) + 성향(10) + 가능 시간(10) + 평점(5)
  선생님의 이야기·관심사 ─► 테마 강도 ─┘
                                      └─► 추천 사유 = 선생님 자신의 이야기에서 근거 문장을 인용

Credentials are optional: they only matter if the guardian asks for them
(filter) or wants study help (small bonus). Claude, when enabled, only helps
turn free text into themes; the score stays explainable and deterministic.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from datetime import date

from . import llm

# theme → keywords (both for reading the guardian's request and the caregiver's story)
THEMES: dict[str, tuple[str, ...]] = {
    "곤충": ("곤충", "벌레", "개미", "나비", "딱정벌레", "사슴벌레", "장수풍뎅이", "잠자리", "채집", "꿀벌", "양봉", "애벌레"),
    "식물·자연": ("식물", "꽃", "나무", "텃밭", "씨앗", "화분", "숲", "자연", "정원", "풀", "산책", "생태", "농사"),
    "동물": ("동물", "강아지", "고양이", "새", "물고기", "동물원", "반려", "바다 생물", "거북"),
    "음악·노래": ("노래", "음악", "피아노", "악기", "합창", "리코더", "기타", "동요", "우쿨렐레", "리듬", "성악", "작곡"),
    "춤·몸놀이": ("춤", "댄스", "율동", "발레", "몸놀이"),
    "미술·만들기": ("그림", "미술", "색칠", "만들기", "공예", "종이접기", "클레이", "그리기", "도자기", "목공"),
    "과학·실험": ("과학", "실험", "발명", "자석", "현미경", "관찰"),
    "우주·별": ("우주", "별", "행성", "로켓", "천문", "망원경"),
    "공룡·화석": ("공룡", "화석", "박물관"),
    "운동·바깥놀이": ("운동", "축구", "줄넘기", "자전거", "공놀이", "놀이터", "바깥놀이", "뛰어", "스키", "등산", "수영"),
    "요리": ("요리", "베이킹", "쿠키", "빵", "음식", "제과", "간식 만들"),
    "책·이야기": ("책", "독서", "동화", "이야기", "그림책", "읽기", "도서관", "글쓰기"),
    "레고·로봇": ("레고", "블록", "조립", "로봇"),
    "코딩": ("코딩", "컴퓨터", "프로그래밍", "게임 만들"),
    "영어·외국어": ("영어", "외국어", "중국어", "일본어", "파닉스"),
    "수학·퍼즐": ("수학", "숫자", "퍼즐", "보드게임", "계산", "구구단"),
    "숙제·학습": ("숙제", "학습", "공부", "받아쓰기", "학교 준비물", "알림장", "한글"),
}

TRAITS: dict[str, tuple[str, ...]] = {
    "낯가림": ("낯", "수줍", "내성적", "소심", "처음 보는"),
    "활발함": ("활발", "에너지", "산만", "뛰어다", "가만히 못"),
    "차분함": ("차분", "조용", "천천히", "느긋"),
    "다정함": ("다정", "따뜻", "칭찬", "공감"),
}
# a caregiver trait that suits a child trait
TRAIT_FIT = {"낯가림": {"차분함", "다정함"}, "활발함": {"활발함"}, "차분함": {"차분함"}}

QUAL_LABEL = {"certified": "교원 자격", "qualified": "보육·돌봄 자격", "none": ""}


def _hits(text: str, words: tuple[str, ...]) -> int:
    return sum(text.count(w) for w in words)


def read_request(text: str) -> tuple[list[str], list[str]]:
    """Guardian's free text → (themes, child traits)."""
    text = text or ""
    themes = [t for t, words in THEMES.items() if _hits(text, words)]
    traits = [t for t, words in TRAITS.items() if _hits(text, words)]
    return themes, traits


def extract_tags(text: str) -> list[str]:
    themes, traits = read_request(text)
    tags = themes + traits
    if llm.enabled() and (text or "").strip():
        data = llm.complete_json(
            "A Korean parent describes their child and what kind of after-school companion they want. "
            "Pick the matching items from this list only: " + ", ".join([*THEMES, *TRAITS]) + ". "
            'Return JSON {"tags": [..]}.',
            text,
            max_tokens=800,
        )
        if isinstance(data, dict):
            allowed = set(THEMES) | set(TRAITS)
            tags += [t for t in data.get("tags", []) if t in allowed and t not in tags]
    return tags


def caregiver_strength(t) -> dict[str, float]:
    """How strongly a caregiver's own life touches each theme (0–1)."""
    story = f"{t.background} {t.headline} {t.story} {t.intro}"
    out: dict[str, float] = {}
    for theme, words in THEMES.items():
        s = 1.0 if theme in (t.interests or []) else 0.0
        n = _hits(story, words)
        if n:
            s = max(s, min(0.9, 0.45 + 0.15 * n))
        if s:
            out[theme] = s
    return out


def _bigrams(text: str) -> Counter:
    s = re.sub(r"[^가-힣a-zA-Z0-9]", "", text or "")
    return Counter(s[i:i + 2] for i in range(len(s) - 1))


def _tfidf_cosine(query: str, docs: list[str]) -> list[float]:
    """Character-bigram TF-IDF similarity: catches context the theme list does not name."""
    q = _bigrams(query)
    bags = [_bigrams(d) for d in docs]
    n = len(docs) or 1
    df = Counter(g for b in bags for g in b)
    idf = {g: math.log((n + 1) / (df[g] + 1)) + 1 for g in df}

    def vec(b: Counter) -> dict[str, float]:
        return {g: c * idf.get(g, math.log(n + 1) + 1) for g, c in b.items()}

    qv = vec(q)
    qn = math.sqrt(sum(v * v for v in qv.values())) or 1.0
    out = []
    for b in bags:
        dv = vec(b)
        dn = math.sqrt(sum(v * v for v in dv.values())) or 1.0
        out.append(sum(qv[g] * dv.get(g, 0.0) for g in qv) / (qn * dn))
    return out


def _weekday(iso: str) -> str:
    try:
        return "월화수목금토일"[date.fromisoformat(iso).weekday()]
    except ValueError:
        return ""


def _evidence(t, theme: str) -> str | None:
    """A sentence from the caregiver's own story that mentions the theme."""
    words = THEMES.get(theme, ())
    for sent in re.split(r"(?<=[.!?요다])\s+", t.story or ""):
        if any(w in sent for w in words):
            return sent.strip()
    return None


def recommend(teachers, text: str, tags: list[str], region: str, day: str, start: str,
              credentialed_only: bool = False, limit: int = 6) -> list[dict]:
    themes_req = [g for g in tags if g in THEMES]
    traits_req = [g for g in tags if g in TRAITS]
    if not themes_req and not traits_req:
        themes_req, traits_req = read_request(text)

    pool = [t for t in teachers if not credentialed_only or t.qual_type in ("certified", "qualified")]
    docs = [f"{t.background} {t.headline} {t.story} {' '.join(t.interests or [])}" for t in pool]
    query = f"{text} {' '.join(tags)}"
    sims = _tfidf_cosine(query, docs) if pool else []
    top_sim = max(sims) if sims and max(sims) > 0 else 1.0

    rows = []
    for t, sim in zip(pool, sims):
        strength = caregiver_strength(t)
        matched = sorted((th for th in themes_req if th in strength), key=lambda th: -strength[th])
        theme_part = (sum(strength[th] for th in matched) / len(themes_req)) * 55 if themes_req else 30
        ctx_part = (sim / top_sim) * 20
        fit = set().union(*(TRAIT_FIT.get(tr, set()) for tr in traits_req)) if traits_req else set()
        trait_part = 10 if fit & set(t.traits or []) else (5 if not traits_req else 0)
        region_ok = t.region in (region or "")
        day_ok = not day or not t.days or _weekday(day) in t.days
        time_ok = not start or t.start_time <= start
        available = region_ok and day_ok and time_ok
        avail_part = 10 if available else 0
        rating_part = max(0.0, t.rating - 4.0) * 5
        study_bonus = 3 if ("숙제·학습" in themes_req and t.qual_type != "none") else 0
        score = int(round(min(99, theme_part + ctx_part + trait_part + avail_part + rating_part + study_bonus)))

        reasons: list[str] = []
        for th in matched[:2]:
            ev = _evidence(t, th)
            reasons.append(f"{th} — “{ev}”" if ev else f"{th}을(를) 즐기는 분이에요")
        if fit & set(t.traits or []):
            reasons.append(f"{'·'.join(sorted(fit & set(t.traits or [])))} 성향이라 {'·'.join(traits_req)} 아이와 잘 맞아요")
        if not reasons:
            reasons.append(t.headline)
        reasons.append(f"{t.region} · 요청한 시간 방문 가능" if available else "요청한 지역·시간과 일부 맞지 않아요")
        rows.append({"teacher": t, "score": score, "reasons": reasons, "available": available, "matched": matched})

    rows.sort(key=lambda r: (r["available"], r["score"]), reverse=True)
    return rows[:limit]
