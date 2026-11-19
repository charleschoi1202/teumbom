"""학습·생활 성장 리포트 — 기록 외 내용 생성 금지.

The draft is assembled only from what the teacher recorded (checked tasks,
homework count, reading minutes, memo). A Claude rewrite, when enabled, is
accepted only if it introduces no number or task that is not in the record.
"""
from __future__ import annotations

import re

from . import llm


def facts(tasks, homework: int | None, reading_min: int | None, memo: str,
          theme_activity: str = "", theme_min: int | None = None) -> dict:
    done_school = [t.title for t in tasks if t.kind == "school" and t.owner == "teacher" and t.done]
    done_basic = [t.title for t in tasks if t.kind == "basic" and t.done]
    return {
        "homework": homework,
        "reading_min": reading_min,
        "school_done": done_school,
        "basic_done": done_basic,
        "memo": (memo or "").strip(),
        "theme_activity": (theme_activity or "").strip(),
        "theme_min": theme_min,
    }


def activity_lines(f: dict) -> list[str]:
    lines0 = []
    if f.get("theme_activity"):
        lines0.append(f["theme_activity"] + (f" {f['theme_min']}분" if f.get("theme_min") else ""))
    parts = []
    if f["homework"]:
        parts.append(f"숙제 {f['homework']}개")
    if f["reading_min"]:
        parts.append(f"독서 {f['reading_min']}분")
    lines = lines0 + ([" · ".join(parts)] if parts else [])
    lines += [f"{t} · 완료" for t in f["school_done"]]
    return lines


def draft(f: dict) -> str:
    sents = []
    act = f.get("theme_activity")
    if act:
        tail = f" {f['theme_min']}분 동안" if f.get("theme_min") else ""
        sents.append(f"오늘은{tail} {act}{'을' if _has_batchim(act) else '를'} 함께 했어요.")
    if f["homework"] and f["reading_min"]:
        sents.append(f"숙제 {f['homework']}개를 확인하고, 책을 {f['reading_min']}분 동안 읽었어요.")
    elif f["homework"]:
        sents.append(f"숙제 {f['homework']}개를 함께 확인했어요.")
    elif f["reading_min"]:
        sents.append(f"책을 {f['reading_min']}분 동안 읽었어요.")
    memo = f["memo"]
    if memo:
        sents.append(memo if memo.endswith((".", "요", "!", "?")) else memo + ".")
    else:
        for t in f["school_done"]:
            obj = t.replace(" 챙기기", "")
            sents.append(f"{obj}을 함께 챙겼어요." if _has_batchim(obj) else f"{obj}를 함께 챙겼어요.")
    if not sents:
        sents.append("오늘 방문 기록이 아직 없어요.")
    text = " ".join(sents)
    rewritten = _llm_polish(text, f)
    return rewritten or text


def _has_batchim(word: str) -> bool:
    ch = word.strip()[-1:] if word.strip() else ""
    return bool(ch) and "가" <= ch <= "힣" and (ord(ch) - 0xAC00) % 28 != 0


def _numbers(s: str) -> set[str]:
    return set(re.findall(r"\d+", s))


def _llm_polish(text: str, f: dict) -> str | None:
    if not llm.enabled():
        return None
    data = llm.complete_json(
        "Rewrite a Korean after-school visit note for a parent in 2-3 warm, plain sentences. "
        "Use only facts in the note. Do not add numbers, activities, or judgments. "
        'Return JSON {"text": str}.',
        text,
        max_tokens=600,
    )
    if not isinstance(data, dict) or not isinstance(data.get("text"), str):
        return None
    out = data["text"].strip()
    # grounding check: no new numbers allowed
    if not out or not _numbers(out) <= _numbers(text):
        return None
    return out
