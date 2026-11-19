"""선생님 확인 심사 보조 — 서류 텍스트를 구조화(운영자가 원본 대조 후 승인).

자격증은 선택 서류예요. 신원·범죄경력 확인은 모든 선생님의 필수 확인 항목입니다.
"""
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
    qual, qual_type = "", "none"
    for pat, fmt, kind in QUAL_PATTERNS:
        mm = re.search(pat, text)
        if mm:
            qual, qual_type = fmt(mm), kind
            break
    years = ""
    my = re.search(r"(?:경력|근무|활동)[^\n\d]{0,12}(\d{1,2})\s*년", text)
    if my:
        years = f"{my.group(1)}년"
    crime = "해당 없음 확인" if re.search(r"범죄경력[\s\S]{0,80}해당\s*없음", text) else "원본 대조 필요"
    return {
        "name": name or "확인 필요",
        "qualification": qual or "자격증 없음 · 경험 기반",
        "qual_type": qual_type,
        "career": years or "원본 대조 필요",
        "crime": crime,
    }
