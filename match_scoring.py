"""
HireLens — Job Match Scoring (structured inputs, explainable weights).
Weights: required 40%, experience 25%, tools 15%, seniority 10%, preferred 10%.
"""

from __future__ import annotations

import re
from typing import Any

from matcher import _tokenize, overall_match_score

W_REQUIRED = 0.40
W_EXPERIENCE = 0.25
W_TOOLS = 0.15
W_SENIORITY = 0.10
W_PREFERRED = 0.10


def _norm_skills(skills: list[Any]) -> list[str]:
    out: list[str] = []
    for s in skills:
        if isinstance(s, str):
            out.append(s.strip().lower())
        elif isinstance(s, dict) and s.get("name"):
            out.append(str(s["name"]).strip().lower())
    return [x for x in out if x]


def _required_terms(job_data: dict[str, Any]) -> list[str]:
    req = job_data.get("required_skills") or []
    must = job_data.get("must_have") or []
    terms: list[str] = []
    for x in req:
        if isinstance(x, str):
            terms.extend(_tokenize(x))
    for m in must:
        if isinstance(m, str):
            terms.extend(_tokenize(m))
    # Dedupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for t in terms:
        if t not in seen and len(t) > 2:
            seen.add(t)
            out.append(t)
    return out[:80]


def _preferred_terms(job_data: dict[str, Any]) -> list[str]:
    pref = job_data.get("preferred_skills") or []
    nice = job_data.get("nice_to_have") or []
    terms: list[str] = []
    for x in pref:
        if isinstance(x, str):
            terms.extend(_tokenize(x))
    for n in nice:
        if isinstance(n, str):
            terms.extend(_tokenize(n))
    seen: set[str] = set()
    out: list[str] = []
    for t in terms:
        if t not in seen and len(t) > 2:
            seen.add(t)
            out.append(t)
    return out[:60]


def _resume_skill_set(resume_data: dict[str, Any]) -> set[str]:
    s: set[str] = set()
    for item in resume_data.get("skills") or []:
        if isinstance(item, dict) and item.get("name"):
            s.add(str(item["name"]).strip().lower())
    for t in resume_data.get("tools") or []:
        s.add(str(t).strip().lower())
    return s


def _score_required(required_terms: list[str], rskills: set[str]) -> tuple[float, list[str], list[str]]:
    if not required_terms:
        return 75.0, [], []  # neutral if JD didn't list extractable requireds
    hits = [t for t in required_terms if t in rskills]
    miss = [t for t in required_terms if t not in rskills]
    # Heavy penalty for missing
    ratio = len(hits) / len(required_terms)
    # Non-linear penalty for gaps
    score = 100.0 * (ratio**1.5)
    return round(min(100.0, score), 1), hits, miss


def _score_experience(resume_text: str, job_text: str) -> float:
    if not resume_text.strip() or not job_text.strip():
        return 0.0
    return overall_match_score(resume_text, job_text)


def _score_tools(job_tools: list[str], rtools: list[str]) -> tuple[float, list[str], list[str]]:
    jt = {str(t).lower() for t in (job_tools or [])}
    rt = {str(t).lower() for t in (rtools or [])}
    if not jt:
        return 70.0, [], []  # neutral
    inter = sorted(jt & rt)
    miss = sorted(jt - rt)
    return round(100.0 * len(inter) / len(jt), 1), inter, miss


def _seniority_fit(job_sen: str | None, resume_text: str) -> tuple[float, str]:
    if not job_sen:
        return 50.0, "Job seniority not detected in JD — neutral score."
    low = resume_text.lower()
    j = job_sen.lower()
    # Simple alignment: if both mention similar level
    pairs = [("intern", "intern"), ("junior", "junior"), ("senior", "senior"), ("lead", "lead"), ("director", "director")]
    for a, b in pairs:
        if j == a and b in low:
            return 90.0, f"Seniority signal aligned ({a})."
    if j == "senior" and "junior" in low and "senior" not in low:
        return 35.0, "Possible seniority mismatch (JD senior vs junior signals in resume)."
    return 60.0, "Seniority fit estimated from coarse heuristics."


def _score_preferred(preferred_terms: list[str], rskills: set[str]) -> tuple[float, list[str], list[str]]:
    if not preferred_terms:
        return 70.0, [], []
    hits = [t for t in preferred_terms if t in rskills]
    miss = [t for t in preferred_terms if t not in rskills]
    return round(100.0 * len(hits) / len(preferred_terms), 1), hits, miss


def score_match(
    resume_data: dict[str, Any],
    job_data: dict[str, Any],
    *,
    resume_text: str = "",
    job_description_text: str = "",
) -> dict[str, Any]:
    """
    Structured match. Pass raw texts for experience relevance TF-IDF when available.
    """
    jd_blob = job_description_text or " ".join(
        str(x) for x in (job_data.get("responsibilities") or []) + (job_data.get("must_have") or [])
    )
    if not jd_blob.strip():
        jd_blob = " ".join(job_data.get("keywords") or [])

    rskills = _resume_skill_set(resume_data)
    req_terms = _required_terms(job_data)
    pref_terms = _preferred_terms(job_data)

    s_req, hit_req, miss_req = _score_required(req_terms, rskills)
    s_exp = _score_experience(resume_text, jd_blob) if resume_text else 0.0
    s_tools, hit_tools, miss_tools = _score_tools(job_data.get("tools") or [], resume_data.get("tools") or [])
    s_sen, sen_note = _seniority_fit(job_data.get("seniority"), resume_text)
    s_pref, hit_pref, miss_pref = _score_preferred(pref_terms, rskills)

    match_score = round(
        W_REQUIRED * s_req
        + W_EXPERIENCE * s_exp
        + W_TOOLS * s_tools
        + W_SENIORITY * s_sen
        + W_PREFERRED * s_pref,
        1,
    )

    if match_score >= 72:
        verdict = "strong"
    elif match_score >= 48:
        verdict = "medium"
    else:
        verdict = "weak"

    strengths: list[str] = []
    if hit_req:
        strengths.append(f"Required-term overlap: {', '.join(hit_req[:8])}")
    if hit_tools:
        strengths.append(f"Tool overlap with JD: {', '.join(hit_tools[:8])}")
    if hit_pref:
        strengths.append(f"Preferred-term overlap: {', '.join(hit_pref[:8])}")

    gaps: list[str] = []
    if miss_req:
        gaps.append(f"Missing or thin on required terms: {', '.join(miss_req[:12])}")
    if miss_tools:
        gaps.append(f"Tools in JD not evident in resume: {', '.join(miss_tools[:10])}")
    if miss_pref:
        gaps.append(f"Preferred terms missing: {', '.join(miss_pref[:10])}")

    missing_kw = list(dict.fromkeys(miss_req + miss_tools + miss_pref))[:25]

    reasoning = (
        f"HireLens match score {match_score}/100: required {s_req} (40%), experience relevance {s_exp:.1f} (25%), "
        f"tools {s_tools} (15%), seniority {s_sen} (10%), preferred {s_pref} (10%). {sen_note}"
    )

    return {
        "match_score": match_score,
        "verdict": verdict,
        "strengths": strengths,
        "gaps": gaps,
        "missing_keywords": missing_kw,
        "reasoning": reasoning,
        "_components": {
            "required_skills_score": s_req,
            "experience_score": round(s_exp, 1),
            "tools_score": s_tools,
            "seniority_score": round(s_sen, 1),
            "preferred_score": s_pref,
        },
    }
