"""Resume vs. job description: TF-IDF cosine similarity and keyword gaps (stdlib only)."""

from __future__ import annotations

import math
import re
from collections import Counter

# Compact English stopword list
_STOP = frozenset(
    """
    a an the and or but if in on at to for of as is was are were be been being
    have has had do does did will would could should may might must can need
    with by from into through during before after above below between under
    again further then once here there when where why how all both each few
    more most other some such no nor not only own same so than too very just
    about against up down out off over under i me my we our you your he she it
    its they them their what which who whom this that these those am
    """.split()
)

_PROFESSION_KEYWORDS: dict[str, tuple[str, ...]] = {
    "java": (
        "java", "spring", "springboot", "hibernate", "jpa", "microservices",
        "maven", "gradle", "junit", "rest", "kafka",
    ),
    "web": (
        "javascript", "typescript", "react", "angular", "vue", "html", "css",
        "node", "frontend", "backend", "fullstack", "nextjs",
    ),
    "ai": (
        "python", "machine", "learning", "llm", "nlp", "tensorflow", "pytorch",
        "data", "model", "prompt", "rag", "embedding",
    ),
    "accounting": (
        "accounting", "gaap", "ifrs", "tax", "audit", "bookkeeping",
        "financial", "reconciliation", "ledger", "payroll", "quickbooks",
    ),
}

_LEVEL_WEIGHT = {
    "learning": 0.4,
    "exposure": 0.65,
    "hands_on": 0.9,
    "expert": 1.0,
}


def _tokenize(text: str) -> list[str]:
    text = text.lower()
    words = re.findall(r"[a-z0-9][a-z0-9+.#-]{1,}", text)
    return [w for w in words if w not in _STOP and len(w) > 1]


def _tfidf_vectors(docs: list[list[str]]) -> tuple[list[dict[str, float]], list[str]]:
    """Return per-document TF-IDF dicts and vocabulary list."""
    n_docs = len(docs)
    df: dict[str, int] = {}
    tfs: list[Counter[str]] = []
    for tokens in docs:
        tf = Counter(tokens)
        tfs.append(tf)
        for term in set(tf):
            df[term] = df.get(term, 0) + 1

    vocab = sorted(df.keys())
    idf: dict[str, float] = {}
    for term in vocab:
        idf[term] = math.log((1.0 + n_docs) / (1.0 + df[term])) + 1.0

    vecs: list[dict[str, float]] = []
    for tf in tfs:
        raw: dict[str, float] = {}
        max_tf = max(tf.values()) if tf else 1
        for term, c in tf.items():
            tf_norm = 0.5 + 0.5 * (c / max_tf)
            raw[term] = tf_norm * idf.get(term, 0.0)
        vecs.append(raw)
    return vecs, vocab


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(a.get(t, 0.0) * b.get(t, 0.0) for t in set(a) | set(b))
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def overall_match_score(resume: str, job_description: str) -> float:
    """Cosine similarity of TF-IDF vectors (0–100)."""
    r, j = _tokenize(resume), _tokenize(job_description)
    if not r or not j:
        return 0.0
    # Unigrams + bigrams as pseudo n-gram boost
    def with_bigrams(tokens: list[str]) -> list[str]:
        out = list(tokens)
        for i in range(len(tokens) - 1):
            out.append(f"{tokens[i]}_{tokens[i + 1]}")
        return out

    r2, j2 = with_bigrams(r), with_bigrams(j)
    vecs, _ = _tfidf_vectors([r2, j2])
    sim = _cosine(vecs[0], vecs[1])
    return float(max(0.0, min(1.0, sim))) * 100.0


def keyword_gaps(resume: str, job_description: str, top_n: int = 25) -> tuple[list[tuple[str, int]], list[tuple[str, int]]]:
    r_tokens = _tokenize(resume)
    j_tokens = _tokenize(job_description)
    j_counter = Counter(j_tokens)
    gaps: list[tuple[str, int]] = []
    for term, count in j_counter.most_common(200):
        if "_" in term:
            continue  # skip bigram labels for readability
        in_resume = r_tokens.count(term)
        if in_resume < max(1, count // 4):
            gaps.append((term, count))
    gaps.sort(key=lambda x: (-x[1], x[0]))
    gaps = gaps[:top_n]

    r_counter = Counter(r_tokens)
    emphasized = [(t, c) for t, c in r_counter.most_common(15) if t not in j_counter]
    emphasized = emphasized[:10]
    return gaps, emphasized


def shared_keywords(resume: str, job_description: str, limit: int = 30) -> list[tuple[str, int, int]]:
    r_c = Counter(_tokenize(resume))
    j_c = Counter(_tokenize(job_description))
    common = set(r_c) & set(j_c)
    out = [(t, r_c[t], j_c[t]) for t in common]
    out.sort(key=lambda x: -(x[1] + x[2]))
    return out[:limit]


def profession_correlation(profession: str, resume: str, job_description: str) -> tuple[float, list[str]]:
    """
    Score whether the resume+JD align with the selected profession (0-100).
    Returns (score, matched_profession_terms).
    """
    prof = (profession or "").strip().lower()
    keys = _PROFESSION_KEYWORDS.get(prof, ())
    if not keys:
        return 0.0, []

    r = set(_tokenize(resume))
    j = set(_tokenize(job_description))
    union = r | j
    matched = [k for k in keys if k in union]
    score = (len(matched) / max(1, len(keys))) * 100.0
    return round(score, 1), matched


def classify_match(overall_score: float, profession_score: float) -> tuple[str, str, float]:
    """
    Build product-facing decision buckets.
    Returns (match_level, effort_level, correlated_score).
    """
    # Weighted score: JD/resume similarity + profession relevance
    correlated = (0.7 * overall_score) + (0.3 * profession_score)
    if correlated >= 75:
        return "High match", "Low effort", round(correlated, 1)
    if correlated >= 50:
        return "Medium match", "Medium effort", round(correlated, 1)
    return "Low match", "High effort", round(correlated, 1)


def parse_skill_growth(raw: str) -> list[tuple[str, str]]:
    """
    Parse user-entered skill updates.
    Input format examples:
      - "LangChain:learning, AWS:exposure"
      - "pytorch:hands_on"
    Returns [(skill, level)].
    """
    if not raw.strip():
        return []
    out: list[tuple[str, str]] = []
    chunks = [c.strip() for c in raw.replace("\n", ",").split(",") if c.strip()]
    for chunk in chunks:
        if ":" in chunk:
            skill, level = [x.strip().lower() for x in chunk.split(":", 1)]
        else:
            skill, level = chunk.strip().lower(), "learning"
        if not skill:
            continue
        if level not in _LEVEL_WEIGHT:
            level = "learning"
        out.append((skill, level))
    return out


def growth_correlation(skill_growth: list[tuple[str, str]], job_description: str) -> tuple[float, list[tuple[str, str]]]:
    """Score how user-added growth skills align with the JD."""
    if not skill_growth:
        return 0.0, []
    jd_tokens = set(_tokenize(job_description))
    matched: list[tuple[str, str]] = []
    total_weight = 0.0
    hit_weight = 0.0
    for skill, level in skill_growth:
        w = _LEVEL_WEIGHT.get(level, 0.4)
        total_weight += w
        # Match on tokenized single tokens in skill phrase
        tokens = skill.replace("-", " ").replace("/", " ").split()
        if any(t in jd_tokens for t in tokens):
            hit_weight += w
            matched.append((skill, level))
    if total_weight == 0:
        return 0.0, []
    return round((hit_weight / total_weight) * 100.0, 1), matched


def tailor_suggestions(resume: str, job_description: str, gaps: list[tuple[str, int]]) -> list[str]:
    """
    Lightweight truthful tailoring suggestions from JD gaps.
    """
    resume_tokens = set(_tokenize(resume))
    suggestions: list[str] = []
    for term, _ in gaps[:8]:
        if term in resume_tokens:
            continue
        suggestions.append(
            f"Add a bullet showing exposure to '{term}' with a concrete project/result."
        )
    if not suggestions:
        suggestions.append("Your resume already covers many job terms. Focus on stronger quantified impact.")
    suggestions.append("Use action + scope + metric format (e.g., 'Built X, reduced Y by Z%').")
    return suggestions[:8]
