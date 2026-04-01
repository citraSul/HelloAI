"""
Resume Tailoring Agent — v1 deterministic: reorder skills by JD overlap only.
Does NOT invent skills, tools, metrics, or experience.
"""

from __future__ import annotations

import re
from typing import Any

from matcher import _tokenize


def _jd_overlap_penalty(tailored: str, job_blob: str) -> list[str]:
    warnings: list[str] = []
    jd_words = _tokenize(job_blob)[:200]
    if len(jd_words) < 8:
        return warnings
    text = tailored.lower()
    for i in range(0, len(jd_words) - 5, 4):
        phrase = " ".join(jd_words[i : i + 6])
        if len(phrase) > 25 and phrase in text:
            warnings.append(
                "Possible close overlap with job description phrasing — rewrite in your own words."
            )
            break
    return warnings


def tailor_resume(
    original_resume: str,
    job_data: dict[str, Any],
    match_analysis: dict[str, Any],
) -> dict[str, Any]:
    text = (original_resume or "").strip()
    changes: list[dict[str, str]] = []
    warnings: list[str] = []

    if len(text) < 30:
        return {
            "tailored_resume": text,
            "changes": [],
            "warnings": ["Resume text too short to tailor meaningfully."],
        }

    jd_blob = " ".join(
        str(x) for x in (job_data.get("keywords") or []) + list(job_data.get("required_skills") or [])[:25]
    )

    new_text = text
    m = re.search(r"(?im)^(\s*(?:technical )?skills\s*:)\s*(.+)$", text)
    if m:
        label, rest = m.group(1), m.group(2)
        parts = [p.strip() for p in re.split(r"[,;|]", rest) if p.strip()]
        if parts:
            priority = set(_tokenize(jd_blob))
            scored = sorted(
                parts,
                key=lambda p: (sum(1 for t in _tokenize(p) if t in priority), p),
                reverse=True,
            )
            old_line = m.group(0)
            new_line = f"{label} {', '.join(scored)}"
            if new_line.strip() != old_line.strip():
                new_text = text.replace(old_line, new_line, 1)
                changes.append(
                    {
                        "section": "skills",
                        "before": old_line[:500],
                        "after": new_line[:500],
                        "reason": "Reordered existing skill terms by overlap with JD keywords (no new terms added).",
                    }
                )

    warnings.extend(_jd_overlap_penalty(new_text, jd_blob))

    if not changes:
        changes.append(
            {
                "section": "meta",
                "before": "",
                "after": "",
                "reason": "No 'Skills:' line found to reorder — add a comma-separated skills line or edit manually.",
            }
        )

    return {
        "tailored_resume": new_text,
        "changes": changes[:20],
        "warnings": warnings,
    }
