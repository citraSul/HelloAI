# HireLens / resume-job-matcher — where we left off

Last updated: **2026-03-31**

This file is the quick “don’t forget” snapshot: architecture, how to run things, and what’s left optional.

## What this repo is

- **Flask app** (`app.py`): SQLite auth, templates, billing hooks, job feed cron, and the **HireLens pipeline** (job analysis → resume parse → match → optional tailor → impact).
- **`hirelens-web/`**: Next.js 15 (App Router) + Prisma + PostgreSQL — dashboard, jobs, tailor studio, analytics, resumes; **mock agents** when Flask isn’t wired; **real Python pipeline** when env is set.
- **`frontend/components/`**: Shared React components (no Next app; optional to port into `hirelens-web/src/components`).

## Run locally

### 1. Python (Flask)

```bash
cd resume-job-matcher
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill SECRET_KEY, optional HIRELENS_INTERNAL_API_KEY, etc.
export HIRELENS_INTERNAL_API_KEY=your-long-secret    # same value as Next
python app.py          # or: flask run --port 8080
```

- Health: `GET http://127.0.0.1:8080/health`
- Internal pipeline (no browser session): `POST /api/internal/v2/pipeline` with header `X-API-Key: <HIRELENS_INTERNAL_API_KEY>`
- Internal impact: `POST /api/internal/evaluate-impact` (same key)

### 2. Next (`hirelens-web`)

```bash
cd resume-job-matcher/hirelens-web
cp .env.example .env.local
# Default uses SQLite (`file:./dev.db` → `prisma/dev.db`) — no Docker Postgres required.
DATABASE_URL="file:./dev.db" npx prisma db push
npm install
npm run dev
```

**Database:** The repo defaults Prisma to **SQLite** for easy local runs. For **PostgreSQL** (e.g. Docker `docker compose up -d`), set `provider = "postgresql"` in `prisma/schema.prisma` and use a `postgresql://…` `DATABASE_URL` in `.env.local`.

- To use **real Flask** for match / tailor / impact (not mocks), set **both** in `.env.local`:

  - `FLASK_BASE_URL=http://127.0.0.1:8080` (or your Flask port)
  - `HIRELENS_INTERNAL_API_KEY=<same string as Flask’s env>`

- If either is missing, those routes still work using **mock** agents.

### 3. Tests

```bash
# Flask smoke tests (from repo root, venv active)
python -m unittest tests.test_smoke -v
```

```bash
# Next production build
cd hirelens-web && npm run build
```

## Env quick reference

| Location | Purpose |
|----------|---------|
| `resume-job-matcher/.env.example` | Flask: `PORT`, `SECRET_KEY`, `HIRELENS_INTERNAL_API_KEY`, Stripe, cron, etc. |
| `hirelens-web/.env.example` | `DATABASE_URL`, `FLASK_BASE_URL`, `HIRELENS_INTERNAL_API_KEY` |

Never commit real `.env` / `.env.local` (they’re gitignored).

## Git / remote

- Remote push was done to **`origin/main`** (repo history on GitHub).
- Latest handoff commit message theme: *Add HireLens web app, pipeline modules, and Flask internal API for Next.js*.

## Done (high level)

- Full pipeline modules: `pipeline.py`, `job_analysis.py`, `resume_parser.py`, `match_scoring.py`, `resume_tailoring.py`, `impact_eval.py`.
- Next app pages + API routes + Prisma models + premium dark UI (HireLens branding).
- Flask internal API key routes for server-to-server calls from Next.
- Smoke tests for pipeline + internal API.

## Optional next steps (not blocking)

- Wire **resume upload** / **job analyze** Next APIs to Flask (today they still use mocks; **Score match** with Flask overwrites parsed job/resume from the pipeline).
- Real **user auth** in Next (currently demo user resolution in services).
- Tighten SQLite **ResourceWarning**s in tests (unclosed connections).
- **shadcn** CLI in `hirelens-web` if you want generated primitives instead of hand-rolled UI.

## Key paths

| Path | What |
|------|------|
| `app.py` | Flask routes, CSRF, internal pipeline routes |
| `pipeline.py` | Orchestrates agents end-to-end |
| `hirelens-web/src/lib/services/` | match / tailor / impact + Flask vs mock |
| `hirelens-web/src/lib/flask/` | HTTP client + env + score normalization |
| `hirelens-web/prisma/schema.prisma` | DB schema |

---

*Regenerate or append this file when you ship major milestones so the next session starts faster.*
