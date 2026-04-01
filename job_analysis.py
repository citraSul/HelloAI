"""
Job Analysis Agent — structured JD extraction from text only.
Does not guess: uses null / empty lists when not grounded in the text.
"""

from __future__ import annotations

import re
from typing import Any

from matcher import _tokenize

# Common seniority cues (grounded: must appear in text)
_SENIORITY_PATTERNS = (
    (r"\b(intern|internship)\b", "intern"),
    (r"\b(entry[\s-]?level|junior|jr\.?|associate)\b", "junior"),
    (r"\b(mid[\s-]?level|intermediate)\b", "mid"),
    (r"\b(senior|sr\.?)\b", "senior"),
    (r"\b(lead|principal|staff)\b", "lead"),
    (r"\b(director|head of)\b", "director"),
    (r"\b(vp|vice president|executive|cxo|chief)\b", "executive"),
)

# Known tools / stack tokens (substring match on normalized phrases)
_TOOL_LEXICON = frozenset(
    """
    python java javascript typescript golang rust kotlin swift
    react angular vue nextjs node django flask fastapi spring
    aws gcp azure kubernetes docker terraform ansible
    sql postgres mysql mongodb redis elasticsearch kafka rabbitmq
    graphql rest grpc linux unix bash git jenkins ci cd
    pytorch tensorflow keras scikit pandas numpy spark hadoop
    snowflake databricks tableau looker jira confluence figma
    """.split()
)


def _first_line_title(text: str) -> str | None:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return None
    first = lines[0]
    if len(first) > 140 or len(first) < 3:
        return None
    # Skip if looks like boilerplate
    if re.match(r"^(about|overview|description)\s*:", first, re.I):
        return None
    return first[:200]


def _company_guess(text: str) -> str | None:
    """Only if explicit pattern — not a real 'guess'."""
    head = text[:1200]
    for pat in (
        r"(?:^|\n)\s*(?:company|employer|organization)\s*[:]\s*([^\n]+)",
        r"\bat\s+([A-Z][A-Za-z0-9&\.\-\s]{2,60}?)(?:\s+—|\s+–|\s+-\s|\n|$)",
    ):
        m = re.search(pat, head, re.I | re.M)
        if m:
            return m.group(1).strip()[:200]
    return None


def _detect_seniority(text: str) -> str | None:
    low = text.lower()
    for pat, label in _SENIORITY_PATTERNS:
        if re.search(pat, low):
            return label
    return None


def _split_sections(text: str) -> dict[str, str]:
    """Rough section buckets by common headers."""
    low = text.lower()
    sections: dict[str, list[str]] = {
        "required": [],
        "preferred": [],
        "general": [],
    }
    current = "general"
    for line in text.splitlines():
        ln = line.strip()
        if not ln:
            continue
        llow = ln.lower()
        if re.match(r"^(required|requirements|must|minimum|qualifications)\b", llow):
            current = "required"
            continue
        if re.match(r"^(preferred|nice to have|plus|bonus|optional)\b", llow):
            current = "preferred"
            continue
        if re.match(r"^(responsibilities|what you will|you will|role)\b", llow):
            current = "general"
            continue
        sections[current].append(ln)
    return {
        "required": "\n".join(sections["required"]),
        "preferred": "\n".join(sections["preferred"]),
        "general": "\n".join(sections["general"]),
    }


def _extract_phrases(blob: str, max_items: int = 25) -> list[str]:
    """Comma / semicolon / bullet split for skill-like phrases."""
    if not blob.strip():
        return []
    parts = re.split(r"[,;•\-\u2022]|\n+", blob)
    out: list[str] = []
    for p in parts:
        t = p.strip()
        t = re.sub(r"^[\-\*\+\d\.\)\s]+", "", t)
        if 2 <= len(t) <= 80:
            out.append(t[:80])
    return out[:max_items]


def _tools_from_text(text: str) -> list[str]:
    toks = set(_tokenize(text))
    found = sorted(toks & _TOOL_LEXICON)
    return found[:40]


def _ats_keywords(text: str, limit: int = 40) -> list[str]:
    from collections import Counter

    toks = _tokenize(text)
    if not toks:
        return []
    counts = Counter(toks)
    ranked = [t for t, _ in counts.most_common(200) if len(t) > 2 and "_" not in t]
    return ranked[:limit]


def analyze_job_description(job_description_text: str) -> dict[str, Any]:
    text = (job_description_text or "").strip()
    empty: dict[str, Any] = {
        "title": None,
        "company": None,
        "seniority": None,
        "required_skills": [],
        "preferred_skills": [],
        "tools": [],
        "responsibilities": [],
        "keywords": [],
        "must_have": [],
        "nice_to_have": [],
    }
    if len(text) < 20:
        return empty

    title = _first_line_title(text)
    company = _company_guess(text)
    seniority = _detect_seniority(text)
    secs = _split_sections(text)

    req_phrases = _extract_phrases(secs["required"])
    pref_phrases = _extract_phrases(secs["preferred"])
    # If sections empty, use light heuristics on whole text for must/nice
    must_have: list[str] = []
    nice_to_have: list[str] = []
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        s = sentence.strip()
        if len(s) < 15:
            continue
        sl = s.lower()
        if any(x in sl for x in (" must ", " required ", " minimum ", " need ")):
            must_have.append(s[:300])
        elif any(x in sl for x in (" preferred ", " nice to have", " plus ", " bonus ")):
            nice_to_have.append(s[:300])
    tools = _tools_from_text(text)
    keywords = _ats_keywords(text)

    # Responsibilities: bullets or numbered lines
    resp: list[str] = []
    for line in text.splitlines():
        ln = line.strip()
        if re.match(r"^[\-\*•\d]+[\.\)]\s+\S", ln):
            resp.append(ln[:400])
    if not resp:
        resp = [ln[:400] for ln in text.splitlines() if 40 < len(ln) < 400][:8]

    return {
        "title": title,
        "company": company,
        "seniority": seniority,
        "required_skills": req_phrases,
        "preferred_skills": pref_phrases,
        "tools": tools,
        "responsibilities": resp[:20],
        "keywords": keywords,
        "must_have": must_have[:15],
        "nice_to_have": nice_to_have[:15],
    }
