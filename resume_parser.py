"""
Resume Parsing Agent — structured candidate data; every skill has evidence.
Does not invent employers, dates, or tools not present in text.
"""

from __future__ import annotations

import re
from typing import Any

from job_analysis import _TOOL_LEXICON
from matcher import _tokenize

_SKILL_SECTION = re.compile(
    r"(?is)(?:^|\n)\s*(technical skills|core skills|skills|technologies|tools)\s*[:]?\s*\n?(.*?)(?=\n\s*(?:experience|employment|work history|education|projects)\s*|\Z)"
)


def _find_skill_section(text: str) -> str | None:
    m = _SKILL_SECTION.search(text)
    if m:
        return m.group(2).strip()
    return None


def _sentences_and_bullets(text: str) -> list[str]:
    lines: list[str] = []
    for line in text.splitlines():
        ln = line.strip()
        if not ln:
            continue
        if re.match(r"^[\-\*•▪\d]+[\.\)]\s*", ln):
            lines.append(re.sub(r"^[\-\*•▪\d]+[\.\)]\s*", "", ln).strip())
        elif len(ln) > 20:
            lines.append(ln)
    return lines


def _normalize_skill_token(t: str) -> str:
    return re.sub(r"\s+", " ", t.strip().lower())[:80]


def parse_resume(resume_text: str) -> dict[str, Any]:
    text = (resume_text or "").strip()
    out: dict[str, Any] = {
        "skills": [],
        "experience": [],
        "tools": [],
        "achievements": [],
    }
    if len(text) < 15:
        return out

    low = text.lower()
    tokens = set(_tokenize(text))

    # Tools: intersection with lexicon (grounded)
    tools_found = sorted(tokens & _TOOL_LEXICON)[:50]
    out["tools"] = tools_found

    # Explicit skills from skills section: comma-separated items
    skill_blob = _find_skill_section(text)
    skills_out: list[dict[str, Any]] = []
    seen: set[str] = set()

    if skill_blob:
        for part in re.split(r"[,;|/\n]", skill_blob):
            name = _normalize_skill_token(part)
            if len(name) < 2 or name in seen:
                continue
            seen.add(name)
            skills_out.append(
                {
                    "name": name,
                    "type": "explicit",
                    "evidence": [skill_blob[:400]],
                }
            )

    # Inferred: tool appears in a non-skill line (sentence evidence)
    for line in _sentences_and_bullets(text):
        ltok = set(_tokenize(line))
        for tool in ltok & _TOOL_LEXICON:
            if tool in seen:
                continue
            # Only infer if not already explicit with same name
            if any(s["name"] == tool for s in skills_out):
                continue
            seen.add(tool)
            skills_out.append(
                {
                    "name": tool,
                    "type": "inferred",
                    "evidence": [line[:400]],
                }
            )

    out["skills"] = skills_out[:60]

    # Experience: heuristic — lines under experience header
    exp_sec = re.search(
        r"(?is)(?:^|\n)\s*(experience|employment|work history|professional experience)\s*[:.]?\s*\n(.*)(?=\n\s*(?:education|skills|projects|certification)\s*|\Z)",
        text,
    )
    if exp_sec:
        block = exp_sec.group(2)
        out["experience"] = [ln.strip()[:500] for ln in block.splitlines() if len(ln.strip()) > 15][:30]
    else:
        out["experience"] = [ln[:500] for ln in _sentences_and_bullets(text) if re.search(r"\b(20\d{2}|19\d{2})\b", ln)][:15]

    # Achievements: bullets with % or $ or numbers
    ach: list[str] = []
    for line in text.splitlines():
        ln = line.strip()
        if re.search(r"[\d]+%|\$[\d,]+|[\d]{2,}%", ln) and len(ln) > 15:
            ach.append(ln[:400])
    out["achievements"] = ach[:20]

    return out
