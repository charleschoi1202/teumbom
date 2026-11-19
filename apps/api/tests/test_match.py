import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_teumbom.db")

from app.ai import match  # noqa: E402
from app.models import Teacher  # noqa: E402
from app.seed import POOL, _teacher  # noqa: E402

POOL_T = [_teacher(r) for r in POOL]
for i, t in enumerate(POOL_T):
    t.id = i + 1


def top(text, region="강원특별자치도 춘천시", **kw):
    tags = match.extract_tags(text)
    rows = match.recommend(POOL_T, text, tags, region, "2026-11-20", "15:00", **kw)
    return tags, rows


def test_insects_and_plants_match_nature_people():
    tags, rows = top("아이가 곤충이랑 식물을 정말 좋아해요. 낯을 좀 가려요.")
    assert {"곤충", "식물·자연", "낯가림"} <= set(tags)
    names = [r["teacher"].name for r in rows[:2]]
    assert "한도윤" in names  # 숲해설가, 곤충·식물, 차분함 — no teaching licence needed
    best = rows[0]
    assert any("“" in reason for reason in best["reasons"])  # reason quotes the caregiver's own story


def test_singing_matches_music_people():
    _, rows = top("노래 부르는 걸 좋아하고 피아노에 관심이 있어요.")
    assert rows[0]["teacher"].name in {"노윤아", "최민준"}
    assert all(r["teacher"].qual_type == "none" for r in rows[:2])


def test_credentials_are_optional_filter():
    _, rows = top("숙제를 봐 주시면 좋겠어요.", credentialed_only=True)
    assert all(r["teacher"].qual_type in ("certified", "qualified") for r in rows)
    _, rows_all = top("숙제를 봐 주시면 좋겠어요.")
    assert len(rows_all) >= len(rows)


def test_context_similarity_beyond_theme_words():
    # "꿀벌" is a keyword of 곤충, but the bee-keeper lives in 홍천: region filter lowers availability, still ranks by context
    _, rows = top("꿀벌이랑 꽃가루 이야기를 좋아해요", region="강원특별자치도 홍천군")
    assert rows[0]["teacher"].name == "유가온"
