"""Optional Claude backend.

Everything in `app.ai` works without an API key (rule-based "demo mode").
Claude is used only when explicitly switched on with TEUMBOM_AI=claude *and*
an ANTHROPIC_API_KEY is present — a key that merely exists in the machine's
environment is never picked up by accident. The rule-based checks still verify
whatever Claude returns.
"""
from __future__ import annotations

import json
import logging
import os
import re

log = logging.getLogger("teumbom.llm")

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-5-5")


def enabled() -> bool:
    return os.getenv("TEUMBOM_AI", "rules").lower() == "claude" and bool(os.getenv("ANTHROPIC_API_KEY"))


def _client():
    import anthropic  # imported lazily so demo mode never needs network access

    return anthropic.Anthropic(timeout=40.0, max_retries=1)


def complete_json(system: str, user: str, max_tokens: int = 4000) -> dict | list | None:
    """Ask Claude for a JSON answer. Returns None on any failure so callers fall back to rules."""
    if not enabled():
        return None
    import anthropic

    try:
        response = _client().beta.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low"},
            system=system,
            messages=[{"role": "user", "content": user}],
        )
    except anthropic.RateLimitError:
        log.warning("Claude rate limited; using rule-based result")
        return None
    except anthropic.APIStatusError as e:
        log.warning("Claude API error %s; using rule-based result", e.status_code)
        return None
    except anthropic.APIConnectionError:
        log.warning("Claude unreachable; using rule-based result")
        return None

    if response.stop_reason == "refusal":
        return None
    text = "".join(b.text for b in response.content if b.type == "text")
    match = re.search(r"(\{.*\}|\[.*\])", text, re.S)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None
