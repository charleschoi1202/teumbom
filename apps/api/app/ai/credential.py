"""교원 서류 검토 보조 — 자격증·경력증명서 텍스트에서 항목을 구조화(운영자가 원본 대조 후 승인)."""
from __future__ import annotations

import re

QUAL_PATTERNS = [
    (r"(초등학교|중등학교|유치원|특수학교)\s*(?:정교사|교사)\s*\(?\s*([12])\s*급\)?", lambda m: f"{m.group(1)} 정교사({m.group(2)}급)", "certified"),
    (r"보육교사\s*([123])\s*급", lambda m: f"보육교사 {m.group(1)}급", "qualified"),
    (r"아이돌봄사", lambda m: "아이돌봄사(국가자격)", "qualified"),
    (r"(아동학|유아교육|초등교육|아동가족)\s*(?:학과|전공)", lambda m: f"{m.group(1)} 전공", "qualified"),
]


def extract(text: str) -> dict:
    name = ""
    m = re.search(r"(?:이름|성명)\s*[:：]?\s*([가-힣]{2,4})", text)
    if m:
        name = m.group(1)
    qual, qual_type = "", ""
    for pat, fmt, kind in QUAL_PATTERNS:
        mm = re.search(pat, text)
        if mm:
            qual, qual_type = fmt(mm), kind
            break
    years = ""
    my = re.search(r"(?:경력|근무)\s*(?:기간)?\s*[:：]?\s*(\d{1,2})\s*년", text)
    if my:
        years = f"{my.group(1)}년"
    return {
        "name": name or "확인 필요",
        "qualification": qual or "확인 필요",
        "qual_type": qual_type or "unknown",
        "career": years or "원본 대조 필요",
    }
