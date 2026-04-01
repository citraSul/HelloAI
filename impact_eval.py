"""
Resume Impact Evaluation — deterministic, content-only metrics (no invented scores).

ATS-style signals are approximated from keyword overlap + length/structure heuristics,
not vendor-specific ATS engines.
"""

from __future__ import annotations

import re
from typing import Any

from matcher import _tokenize, keyword_gaps, overall_match_score


def _jd_focus_terms(job_description: str, limit: int = 60) -> list[str]:
    """High-signal JD tokens (frequency-ranked) for coverage / gap analysis."""
    from collections import Counter

    toks = _tokenize(job_description)
    if not toks:
        return []
    counts = Counter(toks)
    # Drop bigram artifacts if any slipped in
    ranked = [t for t, _ in counts.most_common(300) if "_" not in t and len(t) > 2]
    return ranked[:limit]


def _keyword_coverage_percent(resume: str, jd_terms: list[str]) -> float:
    if not jd_terms:
        return 0.0
    r = set(_tokenize(resume))
    hits = sum(1 for t in jd_terms if t in r)
    return round(100.0 * hits / len(jd_terms), 1)


def _structure_score(text: str) -> float:
    """0–100: presence of common resume section cues (language-agnostic enough)."""
    low = text.lower()
    score = 0.0
    if re.search(r"\b(experience|employment|work history|professional)\b", low):
        score += 35.0
    if re.search(r"\b(education|degree|university|college)\b", low):
        score += 25.0
    if re.search(r"\b(skill|technical|competenc|stack|tool)\b", low):
        score += 25.0
    if re.search(r"\b(project|achievement|impact|deliver)\b", low):
        score += 15.0
    return min(100.0, score)


def _length_adequacy(text: str) -> float:
    """0–100: not too thin for typical ATS text extraction."""
    words = _tokenize(text)
    n = len(words)
    if n < 30:
        return round(100.0 * n / 30.0, 1)
    if n < 120:
        return min(100.0, 60.0 + 40.0 * (n - 30) / 90.0)
    return 100.0


def ats_proxy_score(resume: str, job_description: str, jd_terms: list[str]) -> float:
    """
    Single explainable ATS-style score 0–100:
    55% JD keyword coverage + 25% length adequacy + 20% section structure.
    """
    cov = _keyword_coverage_percent(resume, jd_terms)
    length = _length_adequacy(resume)
    struct = _structure_score(resume)
    return round(0.55 * cov + 0.25 * length + 0.20 * struct, 1)


def _clarity_score(text: str) -> float:
    """0–100: readability heuristics (not NLP model)."""
    raw = text.strip()
    if len(raw) < 40:
        return 20.0
    words = re.findall(r"[A-Za-z]{2,}", raw)
    if not words:
        return 15.0
    sentences = re.split(r"(?<=[.!?])\s+", raw)
    sentences = [s for s in sentences if s.strip()]
    n_sent = max(1, len(sentences))
    avg_words = len(words) / n_sent
    # Prefer ~10–28 words per sentence
    if 10 <= avg_words <= 28:
        sent_score = 100.0
    elif avg_words < 10:
        sent_score = 70.0 + 3.0 * avg_words
    else:
        sent_score = max(40.0, 100.0 - (avg_words - 28) * 2.0)

    fillers = ("very", "really", "basically", "just", "simply", "various", "several")
    filler_hits = sum(raw.lower().count(f" {f} ") + raw.lower().count(f"\n{f} ") for f in fillers)
    filler_penalty = min(25.0, filler_hits * 3.0)

    bullet_lines = sum(1 for line in raw.splitlines() if re.match(r"^\s*[-•*▪]\s+\S", line))
    bullet_bonus = min(15.0, bullet_lines * 2.0)

    caps_ratio = sum(1 for c in raw if c.isupper()) / max(1, len(raw))
    caps_penalty = 20.0 if caps_ratio > 0.35 else 0.0

    score = sent_score - filler_penalty + bullet_bonus - caps_penalty
    return round(max(0.0, min(100.0, score)), 1)


def _weak_sections(text: str) -> list[str]:
    low = text.lower()
    weak: list[str] = []
    if not re.search(r"\b(experience|employment|work)\b", low):
        weak.append("experience")
    if not re.search(r"\b(skill|technical stack|technologies)\b", low):
        weak.append("skills")
    if not re.search(r"\b(education|degree)\b", low):
        weak.append("education")
    if len(_tokenize(text)) < 80:
        weak.append("overall_depth")
    return weak


def _confidence_level(original: str, tailored: str, jd: str) -> str:
    wo, wt, wj = len(_tokenize(original)), len(_tokenize(tailored)), len(_tokenize(jd))
    if wj < 40 or min(wo, wt) < 25:
        return "low"
    if wj < 80 or min(wo, wt) < 50:
        return "medium"
    return "high"


def _likelihood_band(score_0_100: float) -> str:
    if score_0_100 >= 70:
        return "high"
    if score_0_100 >= 45:
        return "medium"
    return "low"


def evaluate_resume_impact(
    *,
    match_result: dict[str, Any] | None,
    original_resume: str,
    tailored_resume: str,
    job_description: str,
) -> dict[str, Any]:
    """
    Content-only impact evaluation. All numeric scores are reproducible from inputs.
    """
    orig = (original_resume or "").strip()
    tail = (tailored_resume or "").strip()
    jd = (job_description or "").strip()

    jd_terms = _jd_focus_terms(jd)
    cov_before = _keyword_coverage_percent(orig, jd_terms)
    cov_after = _keyword_coverage_percent(tail, jd_terms)
    keyword_gain = round(cov_after - cov_before, 1)

    rel_before = overall_match_score(orig, jd) if orig and jd else 0.0
    rel_after = overall_match_score(tail, jd) if tail and jd else 0.0
    relevance_boost = round(rel_after - rel_before, 1)

    ats_before = ats_proxy_score(orig, jd, jd_terms) if orig else 0.0
    ats_after = ats_proxy_score(tail, jd, jd_terms) if tail else 0.0

    clarity = _clarity_score(tail) if tail else _clarity_score(orig)

    gaps_tail, _ = keyword_gaps(tail, jd, top_n=12)
    missing_critical = [t for t, c in gaps_tail[:8]]

    weak = _weak_sections(tail if tail else orig)

    # Impact: normalized gains + absolute quality (all bounded, explainable)
    gain_component = max(0.0, keyword_gain) * 2.0 + max(0.0, relevance_boost) + max(0.0, ats_after - ats_before)
    quality_component = 0.45 * ats_after + 0.35 * rel_after + 0.20 * clarity
    impact_score = round(min(100.0, 0.35 * min(100.0, gain_component * 1.2) + 0.65 * quality_component), 1)

    # ATS pass / recruiter interest: derived bands + numeric proxies (same formula every time)
    ats_pass_numeric = round(0.6 * ats_after + 0.4 * cov_after, 1)
    recruiter_numeric = round(0.5 * rel_after + 0.3 * clarity + 0.2 * cov_after, 1)

    correlated = None
    if match_result and isinstance(match_result, dict):
        correlated = match_result.get("correlated_score")
    if isinstance(correlated, (int, float)):
        recruiter_numeric = round(0.6 * recruiter_numeric + 0.4 * float(correlated), 1)

    apply_rec = "maybe"
    if tail and jd:
        if match_result and str(match_result.get("match_level", "")).startswith("High"):
            apply_rec = "yes"
        elif match_result and str(match_result.get("match_level", "")).startswith("Low") and ats_after < 50 and rel_after < 45:
            apply_rec = "no"
        elif ats_after >= 68 and rel_after >= 62 and keyword_gain >= 3:
            apply_rec = "yes"
        elif ats_after < 38 and rel_after < 40 and keyword_gain <= 1:
            apply_rec = "no"

    conf = _confidence_level(orig, tail, jd)

    notes: list[str] = [
        "ATS-style scores blend JD keyword coverage, resume length, and section headings — not a specific ATS vendor.",
    ]
    if orig.strip() == tail.strip():
        notes.append(
            "Original and tailored resumes are identical here — keyword/relevance gains are zero. "
            "Use the optional “Before tailoring” box on results to paste your earlier version and re-analyze."
        )
    notes.extend(
        [
        f"JD focus-term coverage: {cov_before}% → {cov_after}% ({keyword_gain:+} pp).",
        f"TF-IDF relevance vs JD: {rel_before:.1f} → {rel_after:.1f} ({relevance_boost:+}).",
        f"Clarity (heuristic, tailored): {clarity:.1f}/100.",
        f"ATS-pass proxy (numeric): {ats_pass_numeric:.1f}; band: {_likelihood_band(ats_pass_numeric)}.",
        f"Recruiter-interest proxy (numeric): {recruiter_numeric:.1f}; band: {_likelihood_band(recruiter_numeric)}.",
        ]
    )
    if missing_critical:
        notes.append(f"Top JD terms still thin in tailored resume: {', '.join(missing_critical[:6])}.")
    if weak:
        notes.append(f"Weak or missing section signals: {', '.join(weak)}.")

    return {
        "ats_score_before": ats_before,
        "ats_score_after": ats_after,
        "keyword_gain": keyword_gain,
        "relevance_boost": relevance_boost,
        "clarity_score": clarity,
        "impact_score": impact_score,
        "apply_recommendation": apply_rec,
        "confidence": conf,
        "notes": notes,
        "missing_critical_keywords": missing_critical,
        "weak_sections": weak,
        "ats_pass_estimate": ats_pass_numeric,
        "recruiter_interest_estimate": recruiter_numeric,
        "ats_pass_band": _likelihood_band(ats_pass_numeric),
        "recruiter_interest_band": _likelihood_band(recruiter_numeric),
    }
