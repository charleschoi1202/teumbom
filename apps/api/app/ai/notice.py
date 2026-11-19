"""알림장 챙김 — 가정통신문 → 할 일 추출 + 3중 검증.

Pipeline (기획서 3-3):
  OCR text ──► 블록 분할 ──► 읽기 전략 A(행동 문장 기준) / 전략 B(머리글·라벨 기준)
            ──► ⓐ 원문 근거 대조  ⓑ 두 읽기 결과 일치 비교  ⓒ 양식(필수 항목·요일·기간) 비교
            ──► 선생님께 부탁할 일 / 보호자 할 일(결제·서명) 분리
Nothing here runs a task by itself: the guardian approves every item first.
"""
from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import date

from . import llm

WEEKDAYS = "월화수목금토일"

DATE_RE = re.compile(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*\(\s*([월화수목금토일])\s*\))?")
DOT_DATE_RE = re.compile(r"(?<!\d)(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*\(\s*([월화수목금토일])\s*\)")
AMOUNT_RE = re.compile(r"(\d{1,3}(?:,\d{3})+|\d+)\s*원")

PAY_RE = re.compile(r"납부|입금|결제|계좌|송금")
SIGN_RE = re.compile(r"(동의서|신청서|회신서|참가 신청서|확인서)")
PREP_RE = re.compile(r"준비물|챙겨|지참|가져|준비해|가방에|보내 주|보내주")
EVENT_RE = re.compile(r"체험학습|행사|운동회|공개수업|발표회|상담")
ACTION_RE = re.compile(r"(납부|입금|결제|제출|챙겨|준비해|지참|가져|보내)\s*(?:해\s*)?주(?:세요|시기|십시오)|바랍니다|부탁")
DUE_LABEL_RE = re.compile(r"(?:기한|마감|까지|제출일|납부일)")

TEACHER = "teacher"
GUARDIAN = "guardian"


@dataclass
class Found:
    month: int
    day: int
    weekday: str | None
    text: str


def _dates(s: str) -> list[Found]:
    out = [Found(int(m.group(1)), int(m.group(2)), m.group(3), m.group(0)) for m in DATE_RE.finditer(s)]
    out += [Found(int(m.group(1)), int(m.group(2)), m.group(3), m.group(0)) for m in DOT_DATE_RE.finditer(s)]
    return [d for d in out if 1 <= d.month <= 12 and 1 <= d.day <= 31]


def _iso(year: int, f: Found | None) -> str:
    if not f:
        return ""
    try:
        return date(year, f.month, f.day).isoformat()
    except ValueError:
        return ""


def _label(f: Found | None) -> str:
    return f"{f.month}월 {f.day}일" if f else ""


def _sentences(block: str) -> list[str]:
    parts = re.split(r"(?<=[.!?。])\s+|\n+|(?<=다\.)", block)
    return [p.strip(" -·※*") for p in parts if p and p.strip(" -·※*")]


def _blocks(text: str) -> list[str]:
    """Split a notice into numbered items (1. 2. …, ①②…) or, failing that, paragraphs."""
    lines = [ln.strip() for ln in text.replace("\r", "").split("\n")]
    blocks: list[list[str]] = []
    cur: list[str] = []
    item_start = re.compile(r"^(?:\d{1,2}[.)]|[①②③④⑤⑥⑦⑧⑨⑩]|[가나다라마바사][.)]|□|■|○|-)\s*")
    for ln in lines:
        if not ln:
            if cur:
                blocks.append(cur)
                cur = []
            continue
        if item_start.match(ln) and cur:
            blocks.append(cur)
            cur = []
        cur.append(ln)
    if cur:
        blocks.append(cur)
    return ["\n".join(b) for b in blocks]


def _object_title(block: str) -> str | None:
    m = re.search(r"준비물(?:은|는|:|：)\s*([^.\n]+?)(?:입니다|이에요|예요|$|\.)", block)
    if m:
        items = [x.strip() for x in re.split(r"[,、·및와과]|\s그리고\s", m.group(1)) if x.strip()]
        items = [re.sub(r"(등|입니다)$", "", x).strip() for x in items][:4]
        if items:
            return "·".join(items) + " 챙기기"
    m = re.search(r"([가-힣A-Za-z0-9 ]{2,14}?)\s*(?:을|를)\s*(?:가방에\s*)?(?:챙겨|준비해|지참|가져|보내)", block)
    if m:
        obj = m.group(1).strip()
        obj = re.sub(r"^(?:\d+\.\s*|.*?:\s*|.*?까지\s*)", "", obj).strip()
        if obj:
            return f"{obj} 챙기기"
    m = re.search(r"^(?:\d{1,2}[.)]\s*)?([^:\n]{2,16}?)\s*(?:준비|지참)", block)
    if m:
        return f"{m.group(1).strip()} 챙기기"
    return None


def _classify(block: str) -> tuple[str, str, str] | None:
    """Return (category, owner, title) for one block, or None if it asks nothing of anyone."""
    head = block.split("\n")[0]
    if PAY_RE.search(block):
        m = re.search(r"([가-힣]{1,10}비)(?=\s|를|을|\(|:|$|납부)", block)
        noun = m.group(1) if m else "비용"
        return "납부", GUARDIAN, f"{noun} 납부"
    sm = SIGN_RE.search(block)
    if sm and re.search(r"서명|작성|제출|회신", block):
        return "서명", GUARDIAN, f"{sm.group(1)} 서명·제출"
    if PREP_RE.search(block):
        title = _object_title(block) or f"{re.sub(r'^[0-9.) ]+', '', head)[:14]} 챙기기"
        cat = "제출물" if "제출" in block else "준비물"
        return cat, TEACHER, title
    if EVENT_RE.search(block) and _dates(block):
        name = re.sub(r"^[0-9.)①-⑩ ]+", "", head).split(":")[0].strip()[:16]
        return "행사", GUARDIAN, name or "학교 행사"
    return None


def _strategy_a(block: str) -> tuple[Found | None, str]:
    """읽기 A: the date inside the sentence that actually asks for the action (evidence sentence)."""
    sents = _sentences(block)
    action = [s for s in sents if ACTION_RE.search(s) and _dates(s)]
    if action:
        s = action[-1]
        return _dates(s)[0], s
    dated = [s for s in sents if _dates(s)]
    if dated:
        return _dates(dated[0])[0], dated[0]
    return None, (sents[0] if sents else block)


def _strategy_b(block: str) -> Found | None:
    """읽기 B: the date attached to a deadline label (기한·마감·까지) in the item header, else the first date."""
    head = block.split("\n")[0]
    for m in re.finditer(r"(?:기한|마감|제출일|납부일)\s*[:：]?\s*", head):
        tail = head[m.end():]
        ds = _dates(tail)
        if ds:
            return ds[0]
    ds = _dates(head)
    if ds:
        return ds[0]
    ds = _dates(block)
    return ds[0] if ds else None


def _weekday_ok(year: int, f: Found | None) -> bool:
    if not f or not f.weekday:
        return True
    try:
        return WEEKDAYS[calendar.weekday(year, f.month, f.day)] == f.weekday
    except ValueError:
        return False


def _amount(block: str) -> tuple[int | None, str]:
    m = AMOUNT_RE.search(block)
    if not m:
        return None, ""
    return int(m.group(1).replace(",", "")), m.group(0)


REQUIRED = {"납부": ("due", "amount"), "서명": ("due",), "준비물": ("due",), "제출물": ("due",), "행사": ("due",)}


def _build_item(idx: int, block: str, year: int, visit_date: str, source: str) -> dict | None:
    cls = _classify(block)
    if not cls:
        return None
    category, owner, title = cls
    a_date, evidence = _strategy_a(block)
    b_date = _strategy_b(block)
    amount, amount_text = _amount(block)

    # ⓐ 원문 근거 대조: every value we show must literally exist in the source text
    evidence_ok = evidence in source and (not a_date or a_date.text in source) and (not amount_text or amount_text in source)
    # ⓑ 두 읽기 결과 일치 비교
    consistent = (a_date is None and b_date is None) or (
        a_date is not None and b_date is not None and (a_date.month, a_date.day) == (b_date.month, b_date.day)
    )
    # ⓒ 양식 비교: 필수 항목, 요일-날짜 일치, 상식적인 범위
    due_f = a_date or b_date
    fields = {"due": due_f, "amount": amount}
    template_ok = all(fields.get(k) for k in REQUIRED.get(category, ()))
    template_ok = template_ok and _weekday_ok(year, a_date) and _weekday_ok(year, b_date)
    if amount is not None and amount > 300_000:
        template_ok = False

    warning = None
    if not consistent and a_date and b_date:
        warning = f"원문 {_label(a_date)} · 읽은 날짜 {_label(b_date)}"
    elif not template_ok:
        if due_f and not (_weekday_ok(year, a_date) and _weekday_ok(year, b_date)):
            warning = f"{_label(due_f)}의 요일이 달력과 달라요"
        elif not due_f:
            warning = "기한을 찾지 못했어요"
        else:
            warning = "평소 통신문 양식과 다른 항목이에요"
    elif not evidence_ok:
        warning = "원문에서 근거를 찾지 못했어요"

    # Shown value: when the two reads disagree we show read B and ask the guardian to confirm.
    shown = b_date if (not consistent and b_date) else due_f
    due_iso = _iso(year, shown)
    if category in ("준비물", "제출물"):
        detail = f"{category} · {_label_iso(visit_date)} 방문" if due_iso and visit_date and due_iso >= visit_date else f"{category} · {_label(shown)}까지"
    else:
        detail = f"{category} · {_label(shown)}까지" if shown else category

    needs_review = not (evidence_ok and consistent and template_ok)
    return {
        "id": idx,
        "category": category,
        "owner": owner,
        "title": title,
        "detail": detail,
        "due": due_iso,
        "due_label": _label(shown),
        "source_due": _label(a_date),
        "read_due": _label(b_date),
        "amount": amount,
        "evidence": evidence,
        "checks": {"evidence": evidence_ok, "consistent": consistent, "template": template_ok},
        "warning": warning,
        "confidence": "low" if needs_review else "high",
        "status": "pending" if needs_review else "verified",
        "sendable": owner == TEACHER,
    }


def _label_iso(iso: str) -> str:
    try:
        d = date.fromisoformat(iso)
    except ValueError:
        return ""
    return f"{d.month}월 {d.day}일"


def _title(text: str) -> str:
    for ln in text.split("\n"):
        s = ln.strip()
        if s and not re.search(r"가정통신문\s*(제|$)|^\d{4}|학교\s*$", s) and len(s) <= 30 and "안내" in s:
            return s
    for ln in text.split("\n"):
        s = ln.strip()
        if 4 <= len(s) <= 30 and not s.startswith(("학부모", "1.", "※")):
            return s
    return "가정통신문"


def extract(text: str, visit_date: str = "", year: int | None = None) -> dict:
    """Return {title, items, engine}. Items needing review carry status 'pending' + a warning."""
    year = year or (int(visit_date[:4]) if visit_date else date.today().year)
    blocks = _blocks(text)
    items: list[dict] = []
    for b in blocks:
        it = _build_item(len(items), b, year, visit_date, text)
        if it and not any(x["title"] == it["title"] for x in items):
            items.append(it)
    engine = "rules"

    if llm.enabled():
        engine = _cross_check_with_llm(text, items, year) or engine

    # 행사 info rows are kept for the guardian but never sent to the teacher
    return {"title": _title(text), "items": items, "engine": engine}


LLM_SYSTEM = (
    "You extract action items from a Korean elementary-school parent notice (가정통신문). "
    "Return only JSON: {\"items\": [{\"title\": str, \"category\": one of 준비물|제출물|납부|서명|행사, "
    "\"due\": \"M월 D일\" or \"\", \"amount\": int or null, \"evidence\": exact sentence copied from the notice}]}. "
    "Copy evidence verbatim. Never invent dates or amounts that are not written in the notice."
)


def _cross_check_with_llm(text: str, items: list[dict], year: int) -> str | None:
    """Third reader: Claude. Any disagreement with the rule reads becomes a review flag; nothing is auto-applied."""
    data = llm.complete_json(LLM_SYSTEM, text)
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        return None
    for it in items:
        match = next((x for x in data["items"] if isinstance(x, dict) and x.get("category") == it["category"]), None)
        if not match:
            continue
        llm_due = str(match.get("due") or "")
        ev = str(match.get("evidence") or "")
        if ev and ev not in text:  # hallucinated evidence → distrust the LLM read
            continue
        if llm_due and it["due_label"] and llm_due.replace(" ", "") != it["due_label"].replace(" ", ""):
            it["checks"]["consistent"] = False
            it["warning"] = it["warning"] or f"AI 읽기 {llm_due} · 규칙 읽기 {it['due_label']}"
            it["status"], it["confidence"] = "pending", "low"
    return "claude+rules"
