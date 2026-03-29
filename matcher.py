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
