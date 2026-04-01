"""
HireLens — orchestrated pipeline (structured JSON end-to-end).
"""

from __future__ import annotations

from typing import Any

from brand import BRAND_NAME
from impact_eval import evaluate_resume_impact
from job_analysis import analyze_job_description
from match_scoring import score_match
from resume_parser import parse_resume
from resume_tailoring import tailor_resume


def run_pipeline(
    job_description_text: str,
    resume_text: str,
    *,
    include_tailoring: bool = False,
    include_impact: bool = True,
) -> dict[str, Any]:
    """
    Job Description → Job Analysis → Resume Parse → Match Score → optional Tailor → Impact.
    """
    jd = (job_description_text or "").strip()
    resume = (resume_text or "").strip()

    warnings: list[str] = []
    if len(jd) < 20:
        warnings.append("Job description very short — extraction may be empty.")
    if len(resume) < 15:
        warnings.append("Resume very short — parsing may be empty.")

    job_data = analyze_job_description(jd)
    resume_data = parse_resume(resume)
    match_analysis = score_match(
        resume_data,
        job_data,
        resume_text=resume,
        job_description_text=jd,
    )

    out: dict[str, Any] = {
        "brand": BRAND_NAME,
        "job_data": job_data,
        "resume_data": resume_data,
        "match_analysis": {k: v for k, v in match_analysis.items() if not k.startswith("_")},
        "match_components": match_analysis.get("_components"),
        "warnings": warnings,
    }

    tailored: dict[str, Any] | None = None
    if include_tailoring:
        tailored = tailor_resume(resume, job_data, match_analysis)
        out["tailoring"] = tailored

    if include_impact:
        tail_text = tailored["tailored_resume"] if tailored else resume
        v = match_analysis.get("verdict", "medium")
        level_map = {"strong": "High match", "medium": "Medium match", "weak": "Low match"}
        impact = evaluate_resume_impact(
            match_result={
                "correlated_score": match_analysis["match_score"],
                "match_level": level_map.get(str(v), "Medium match"),
            },
            original_resume=resume,
            tailored_resume=tail_text,
            job_description=jd,
        )
        out["impact"] = impact

    return out
