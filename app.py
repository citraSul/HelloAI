"""Production WSGI app with auth, CSRF, billing scaffold, and pipeline."""

from __future__ import annotations

import json
import os
import secrets
import sqlite3
from datetime import UTC, datetime
from functools import wraps

from flask import Flask, abort, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from matcher import (
    classify_match,
    growth_correlation,
    keyword_gaps,
    overall_match_score,
    parse_skill_growth,
    profession_correlation,
    shared_keywords,
    tailor_suggestions,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 512 * 1024
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-me")
DB_PATH = os.environ.get("APP_DB_PATH", "app.db")

CSRF_EXEMPT_PATHS = {"/api/stripe/webhook", "/api/alerts/intake"}


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                plan TEXT NOT NULL DEFAULT 'free',
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                created_at TEXT NOT NULL,
                profession TEXT NOT NULL,
                score REAL NOT NULL,
                profession_score REAL NOT NULL,
                growth_score REAL NOT NULL,
                correlated_score REAL NOT NULL,
                match_level TEXT NOT NULL,
                effort_level TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'new',
                top_keywords TEXT NOT NULL,
                resume_text TEXT NOT NULL,
                jd_text TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        # Lightweight migration for existing installations.
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(analyses)").fetchall()}
        if "user_id" not in cols:
            conn.execute("ALTER TABLE analyses ADD COLUMN user_id INTEGER")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                stripe_customer_id TEXT UNIQUE,
                stripe_subscription_id TEXT UNIQUE,
                status TEXT NOT NULL,
                current_period_end TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        sub_cols = {row["name"] for row in conn.execute("PRAGMA table_info(subscriptions)").fetchall()}
        if "user_id" not in sub_cols:
            conn.execute("ALTER TABLE subscriptions ADD COLUMN user_id INTEGER")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS alert_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                source TEXT NOT NULL,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                description TEXT NOT NULL,
                url TEXT NOT NULL UNIQUE,
                processed INTEGER NOT NULL DEFAULT 0
            )
            """
        )


def current_user_id() -> int | None:
    uid = session.get("user_id")
    if isinstance(uid, int):
        return uid
    return None


def current_user_email() -> str:
    return str(session.get("user_email", ""))


def login_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not current_user_id():
            return redirect(url_for("login"))
        return fn(*args, **kwargs)

    return wrapped


def csrf_token() -> str:
    token = session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
    return str(token)


def verify_csrf() -> None:
    if request.method != "POST":
        return
    if request.path in CSRF_EXEMPT_PATHS:
        return
    sent = request.headers.get("X-CSRF-Token") or request.form.get("csrf_token")
    if not sent or sent != session.get("csrf_token"):
        abort(400, description="Invalid CSRF token")


@app.before_request
def setup_request() -> None:
    init_db()
    verify_csrf()


@app.context_processor
def inject_common():
    return {
        "csrf_token": csrf_token(),
        "auth_user_email": current_user_email(),
        "is_authenticated": current_user_id() is not None,
        "config_support_email": os.environ.get("SUPPORT_EMAIL", "support@example.com"),
    }


@app.route("/health")
def health() -> tuple[dict[str, str], int]:
    return {"status": "ok"}, 200


@app.route("/release-readiness")
def release_readiness():
    checks = {
        "secret_key_configured": app.config["SECRET_KEY"] != "dev-only-change-me",
        "stripe_secret_key": bool(os.environ.get("STRIPE_SECRET_KEY")),
        "stripe_price_id_pro": bool(os.environ.get("STRIPE_PRICE_ID_PRO")),
        "stripe_webhook_secret": bool(os.environ.get("STRIPE_WEBHOOK_SECRET")),
        "app_base_url": bool(os.environ.get("APP_BASE_URL")),
        "support_email": bool(os.environ.get("SUPPORT_EMAIL")),
    }
    ready = all(checks.values())
    return jsonify({"ready": ready, "checks": checks})


@app.route("/")
def index() -> str:
    return render_template("index.html", profession="", skill_growth="")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        return render_template("signup.html", error="")
    email = (request.form.get("email") or "").strip().lower()
    password = request.form.get("password") or ""
    if "@" not in email or len(password) < 8:
        return render_template("signup.html", error="Use a valid email and password (min 8 chars)."), 400
    try:
        with _db() as conn:
            conn.execute(
                "INSERT INTO users(email, password_hash, plan, created_at) VALUES (?, ?, 'free', ?)",
                (email, generate_password_hash(password), datetime.now(UTC).isoformat()),
            )
    except sqlite3.IntegrityError:
        return render_template("signup.html", error="Email already exists."), 400
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html", error="")
    email = (request.form.get("email") or "").strip().lower()
    password = request.form.get("password") or ""
    with _db() as conn:
        row = conn.execute("SELECT id, email, password_hash FROM users WHERE email=?", (email,)).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return render_template("login.html", error="Invalid credentials."), 401
    session["user_id"] = int(row["id"])
    session["user_email"] = str(row["email"])
    return redirect(url_for("dashboard"))


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("index"))


@app.route("/dashboard")
@login_required
def dashboard() -> str:
    with _db() as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, profession, correlated_score, match_level, effort_level, status
            FROM analyses
            WHERE user_id=?
            ORDER BY id DESC
            LIMIT 100
            """,
            (current_user_id(),),
        ).fetchall()
    return render_template("dashboard.html", analyses=rows)


@app.route("/pricing")
def pricing() -> str:
    return render_template("pricing.html")


@app.route("/privacy")
def privacy() -> str:
    return render_template("privacy.html")


@app.route("/terms")
def terms() -> str:
    return render_template("terms.html")


@app.route("/refund")
def refund() -> str:
    return render_template("refund.html")


@app.route("/api/create-checkout-session", methods=["POST"])
@login_required
def create_checkout_session():
    secret = os.environ.get("STRIPE_SECRET_KEY")
    price_id = os.environ.get("STRIPE_PRICE_ID_PRO")
    base_url = os.environ.get("APP_BASE_URL", "http://127.0.0.1:8080")
    if not secret or not price_id:
        return jsonify({"ok": False, "message": "Stripe not configured yet."}), 400
    try:
        import stripe  # type: ignore

        stripe.api_key = secret
        session_obj = stripe.checkout.Session.create(
            mode="subscription",
            customer_email=current_user_email(),
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{base_url}/pricing?status=success",
            cancel_url=f"{base_url}/pricing?status=cancel",
        )
        return jsonify({"ok": True, "url": session_obj.url})
    except Exception as exc:  # pragma: no cover
        return jsonify({"ok": False, "message": f"Checkout error: {exc}"}), 500


@app.route("/api/stripe/webhook", methods=["POST"])
def stripe_webhook():
    secret = os.environ.get("STRIPE_SECRET_KEY")
    endpoint_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        return jsonify({"ok": False, "message": "Stripe not configured"}), 400
    payload = request.get_data(as_text=False)
    sig_header = request.headers.get("Stripe-Signature", "")
    try:
        import stripe  # type: ignore

        stripe.api_key = secret
        if endpoint_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        else:
            event = json.loads(payload.decode("utf-8"))
    except Exception as exc:
        return jsonify({"ok": False, "message": f"Invalid webhook: {exc}"}), 400

    event_type = event.get("type")
    obj = event.get("data", {}).get("object", {})
    if event_type in {"checkout.session.completed", "customer.subscription.updated", "customer.subscription.created"}:
        customer = obj.get("customer", "")
        subscription = obj.get("subscription", "") or obj.get("id", "")
        status = obj.get("status", "active")
        customer_email = obj.get("customer_details", {}).get("email", "")
        user_id = None
        if customer_email:
            with _db() as conn:
                user = conn.execute("SELECT id FROM users WHERE email=?", (customer_email,)).fetchone()
                if user:
                    user_id = int(user["id"])
        with _db() as conn:
            conn.execute(
                """
                INSERT INTO subscriptions(user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(stripe_subscription_id) DO UPDATE SET
                    status=excluded.status,
                    current_period_end=excluded.current_period_end
                """,
                (
                    user_id,
                    customer,
                    subscription,
                    status,
                    str(obj.get("current_period_end", "")),
                ),
            )
            if user_id and status in {"active", "trialing"}:
                conn.execute("UPDATE users SET plan='pro' WHERE id=?", (user_id,))
    return jsonify({"ok": True})


@app.route("/api/alerts/intake", methods=["POST"])
def alert_intake():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    company = (data.get("company") or "").strip()
    description = (data.get("description") or "").strip()
    url = (data.get("url") or "").strip()
    source = (data.get("source") or "manual").strip()
    if not title or not company or not description or not url:
        return jsonify({"ok": False, "message": "title, company, description, url are required"}), 400
    try:
        with _db() as conn:
            conn.execute(
                """
                INSERT INTO alert_jobs(created_at, source, title, company, description, url, processed)
                VALUES (?, ?, ?, ?, ?, ?, 0)
                """,
                (datetime.now(UTC).isoformat(), source, title, company, description, url),
            )
    except sqlite3.IntegrityError:
        return jsonify({"ok": True, "message": "Already ingested"})
    return jsonify({"ok": True, "message": "Alert job ingested"})


@app.route("/api/analyses/<int:analysis_id>/status", methods=["POST"])
@login_required
def update_analysis_status(analysis_id: int):
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        status = str(payload.get("status", "")).strip()
    else:
        status = (request.form.get("status") or "").strip()
    if status not in {"new", "reviewed", "applied", "interview", "rejected", "offer"}:
        return jsonify({"ok": False, "message": "Invalid status"}), 400
    with _db() as conn:
        conn.execute(
            "UPDATE analyses SET status=? WHERE id=? AND user_id=?",
            (status, analysis_id, current_user_id()),
        )
    return jsonify({"ok": True})


@app.route("/analyze", methods=["POST"])
@login_required
def analyze() -> str:
    resume = request.form.get("resume") or ""
    jd = request.form.get("jd") or ""
    profession = (request.form.get("profession") or "").strip().lower()
    skill_growth_raw = request.form.get("skill_growth") or ""
    skill_growth = parse_skill_growth(skill_growth_raw)

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
            profession=profession,
            profession_score=0.0,
            profession_terms=[],
            match_level="N/A",
            effort_level="N/A",
            correlated_score=0.0,
            skill_growth=skill_growth_raw,
            growth_score=0.0,
            growth_matches=[],
            tailor_actions=[],
            analysis_id=0,
        )

    score = overall_match_score(resume, jd)
    gaps, extra = keyword_gaps(resume, jd)
    shared = shared_keywords(resume, jd)
    profession_score, profession_terms = profession_correlation(profession, resume, jd)
    growth_score, growth_matches = growth_correlation(skill_growth, jd)
    merged_prof_score = min(100.0, (profession_score * 0.8) + (growth_score * 0.2))
    match_level, effort_level, correlated_score = classify_match(score, merged_prof_score)
    tailor_actions = tailor_suggestions(resume, jd, gaps)

    with _db() as conn:
        cur = conn.execute(
            """
            INSERT INTO analyses(
                user_id, created_at, profession, score, profession_score, growth_score, correlated_score,
                match_level, effort_level, status, top_keywords, resume_text, jd_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)
            """,
            (
                current_user_id(),
                datetime.now(UTC).isoformat(),
                profession,
                score,
                profession_score,
                growth_score,
                correlated_score,
                match_level,
                effort_level,
                ", ".join([t for t, _ in gaps[:10]]),
                resume,
                jd,
            ),
        )
        analysis_id = cur.lastrowid

    return render_template(
        "results.html",
        error=None,
        score=score,
        gaps=gaps,
        shared=shared[:15],
        extra=extra,
        resume=resume,
        jd=jd,
        profession=profession,
        profession_score=profession_score,
        profession_terms=profession_terms,
        growth_score=growth_score,
        growth_matches=growth_matches,
        match_level=match_level,
        effort_level=effort_level,
        correlated_score=correlated_score,
        skill_growth=skill_growth_raw,
        tailor_actions=tailor_actions,
        analysis_id=analysis_id,
    )


def main() -> None:
    port = int(os.environ.get("PORT", "8765"))
    debug = os.environ.get("FLASK_DEBUG") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)


if __name__ == "__main__":
    main()
