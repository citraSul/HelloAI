"""Fetch public developer job listings (no LinkedIn — use approved APIs only)."""

from __future__ import annotations

import json
import re
from html import unescape
from typing import Any

import certifi
import requests

# Remote OK publishes a public JSON API (remote-friendly dev / tech roles).
REMOTEOK_API = "https://remoteok.com/api"

# Heuristic: programming / CS / software-adjacent roles only.
_CS_TERMS = (
    "developer",
    "engineer",
    "programming",
    "software",
    "backend",
    "front end",
    "frontend",
    "fullstack",
    "full stack",
    "devops",
    "sre",
    "data scientist",
    "machine learning",
    "data engineer",
    "ml engineer",
    "ai engineer",
    "java",
    "python",
    "javascript",
    "typescript",
    "react",
    "node",
    "golang",
    "rust",
    "kubernetes",
    "linux",
    "computer science",
    "web developer",
    "mobile dev",
    "ios",
    "android",
    "security engineer",
    "qa automation",
    "test automation",
    "blockchain dev",
    "crypto",
)


def _strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    text = unescape(text)
    return " ".join(text.split())


def _is_cs_related(title: str, tags: list[str], description: str) -> bool:
    blob = f"{title} {' '.join(tags)} {description[:8000]}".lower()
    return any(term in blob for term in _CS_TERMS)


def _fetch_remoteok_json(*, timeout: int) -> list[Any] | None:
    """HTTPS using certifi so macOS Python SSL issues do not silently empty the feed."""
    try:
        r = requests.get(
            REMOTEOK_API,
            headers={"User-Agent": "ResumeJobMatcher/1.0 (feed; +local)"},
            timeout=timeout,
            verify=certifi.where(),
        )
        r.raise_for_status()
        data = r.json()
    except (requests.RequestException, json.JSONDecodeError, TypeError, ValueError):
        return None
    if not isinstance(data, list):
        return None
    return data


def fetch_remoteok_cs_jobs(*, max_jobs: int = 80, timeout: int = 60) -> list[dict[str, Any]]:
    """
    Returns jobs: title, company, description (plain text), url, source.
    Uses Remote OK's public API (not LinkedIn).
    """
    data = _fetch_remoteok_json(timeout=timeout)
    if not data or len(data) < 2:
        return []

    out: list[dict[str, Any]] = []
    for row in data[1:]:
        if not isinstance(row, dict):
            continue
        title = (row.get("position") or "").strip() or "Role"
        company = (row.get("company") or "").strip() or "Company"
        desc_html = row.get("description") or ""
        tags = [str(t) for t in (row.get("tags") or []) if t]
        desc = _strip_html(desc_html)
        if len(desc) < 40:
            continue
        if not _is_cs_related(title, tags, desc):
            continue
        slug = (row.get("slug") or "").strip()
        jid = str(row.get("id") or "").strip()
        if slug:
            url = f"https://remoteok.com/remote-jobs/{slug}"
        elif jid:
            url = f"https://remoteok.com/remote-jobs?id={jid}"
        else:
            continue

        out.append(
            {
                "title": title[:500],
                "company": company[:300],
                "description": desc[:120_000],
                "url": url[:2000],
                "source": "remoteok",
            }
        )
        if len(out) >= max_jobs:
            break

    return out
