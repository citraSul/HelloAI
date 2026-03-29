"""
Production WSGI app: resume ↔ job description matcher.

Local dev:  FLASK_DEBUG=1 python app.py
Production: gunicorn -w 2 -b 0.0.0.0:$PORT app:app
"""

from __future__ import annotations

import os

from flask import Flask, render_template, request

from matcher import keyword_gaps, overall_match_score, shared_keywords

app = Flask(__name__)
# Prevent huge pastes from tying up workers (adjust if needed)
app.config["MAX_CONTENT_LENGTH"] = 512 * 1024


@app.route("/health")
def health() -> tuple[dict[str, str], int]:
    """Load balancer / platform health checks."""
    return {"status": "ok"}, 200


@app.route("/")
def index() -> str:
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze() -> str:
    resume = request.form.get("resume") or ""
    jd = request.form.get("jd") or ""

    if not resume.strip() or not jd.strip():
        return render_template(
            "results.html",
            error="Please provide both resume and job description.",
            score=None,
            gaps=[],
            shared=[],
            extra=[],
            resume=resume,
            jd=jd,
        )

    score = overall_match_score(resume, jd)
    gaps, extra = keyword_gaps(resume, jd)
    shared = shared_keywords(resume, jd)

    return render_template(
        "results.html",
        error=None,
        score=score,
        gaps=gaps,
        shared=shared[:15],
        extra=extra,
        resume=resume,
        jd=jd,
    )


def main() -> None:
    port = int(os.environ.get("PORT", "8765"))
    debug = os.environ.get("FLASK_DEBUG") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)


if __name__ == "__main__":
    main()
