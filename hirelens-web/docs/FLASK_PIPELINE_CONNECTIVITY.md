# Flask pipeline connectivity (Next.js ↔ Python)

This document explains why `fetch failed` / `Flask pipeline unreachable` happens and how the app is hardened against it.

## Variable name

The app uses **`FLASK_BASE_URL`** everywhere (there is no `FLASK_PIPELINE_URL`). It must match the origin where Flask listens (`scheme` + `host` + `port`), no trailing slash.

## Strict URL rules (enforced in code)

`parseFlaskBaseUrl` / startup / `assertRealModePipelineConfigured` require:

* `http://` or `https://`
* Host present
* **Path must be `/` only** (origin only — not `http://host:8765/api`)
* No query string or fragment
* Trailing slashes on the origin are normalized away

Port alignment: **`resume-job-matcher` `PORT`** (default **8765** in `app.py`) must match the port in **`hirelens-web` `FLASK_BASE_URL`**. Both `.env.example` files use **8765** as the default convention.

## `RUNNING_IN_DOCKER`

Set to `1` (or `true` / `yes`) on the **Next.js** container image. When set, **`FLASK_BASE_URL` must not** use `127.0.0.1` or `localhost` for Flask — use the Compose/Kubernetes **service DNS name** (e.g. `http://hirelens-flask:8765`).

## Root causes (typical)

| Symptom | Likely cause |
|--------|----------------|
| No HTTP response, `ECONNREFUSED` | Flask not running, wrong port, or firewall |
| `ENOTFOUND` | Bad hostname in `FLASK_BASE_URL` (typos, wrong Docker service name) |
| Timeout / `AbortError` | Flask overloaded, network partition, or `FLASK_FETCH_TIMEOUT_MS` too low |
| Works locally, fails in prod | Next container calling `http://127.0.0.1` — that is **itself**, not Flask |
| Random 502/503 | Transient upstream — retries help |

## What we implemented

1. **Centralized config** — `validateFlaskBaseUrlForPipeline()` and env helpers in `src/lib/flask/env.ts`.
2. **Timeouts** — every attempt uses `AbortController` + `FLASK_FETCH_TIMEOUT_MS` (default 45s).
3. **Retries** — exponential backoff on network errors and on HTTP 502, 503, 504, 429, 408 (`FLASK_FETCH_MAX_RETRIES`, default 2 → up to 3 attempts).
4. **Error typing** — `FlaskPipelineError` with `kind`: `network` | `http` | `parse` | `upstream`; API routes return **503** for network failures with structured `details`.
5. **Logging** — `[HireLens] Flask network failure (giving up)` includes URL, attempts, and error code when available.
6. **Startup preflight** — when `APP_MODE=real` and pipeline env is set, `instrumentation.ts` runs `GET {FLASK_BASE_URL}/health` and logs **OK** or a **warning** (Node runtime only, not Edge).
7. **Flask `/health`** — returns `{"status":"ok","service":"hirelens-flask"}`; Flask binds to **`0.0.0.0`** in `app.py` so it accepts traffic from other containers.
8. **Explicit Node runtime** — match / tailor / impact API routes set `export const runtime = "nodejs"` so they never run on Edge (where outbound `fetch` semantics differ).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `FLASK_BASE_URL` | Base URL of Flask (no trailing slash), e.g. `http://127.0.0.1:8765` or `http://flask:5000` in Compose |
| `HIRELENS_INTERNAL_API_KEY` | Same value on Flask and Next for internal routes |
| `FLASK_FETCH_TIMEOUT_MS` | Per-attempt timeout (default 45000) |
| `FLASK_FETCH_MAX_RETRIES` | Extra attempts after the first (0–5, default 2) |
| `FLASK_STARTUP_HEALTH_TIMEOUT_MS` | Startup `GET /health` timeout (default 5000, max 8000) |

## Docker / Kubernetes

- **Do not** set `FLASK_BASE_URL=http://127.0.0.1:...` from **inside** the Next container — use the **service DNS name** and internal port (e.g. `http://hirelens-flask:8765`).
- Ensure both services share a **Docker network** (or K8s Service + ClusterIP).
- Use `depends_on` (Compose) or readiness probes so Next starts after Flask is listening.
- External browsers still use your public URL; **only** server-side Next uses `FLASK_BASE_URL`.

The repo’s `docker-compose.yml` currently only runs Postgres; add a Flask service following the same pattern when you containerize the Python app.

## “Connection refused” to `127.0.0.1:8765`

1. **Config is usually correct** — Next reads `FLASK_BASE_URL` (e.g. `http://127.0.0.1:8765` from `.env` / `.env.local`).
2. **Refused means no TCP listener** — start Flask: `cd resume-job-matcher && python3 app.py`. Default Flask `PORT` is **8765** (`app.py`); `resume-job-matcher/.env` can set `PORT` — it must match the port in `FLASK_BASE_URL`.
3. **Same machine** — `127.0.0.1` is only valid when the Next.js **server process** runs on the same host as Flask (typical local dev). It is **wrong** from inside a Docker container unless you use host networking.
4. Confirm: `lsof -iTCP:8765 -sTCP:LISTEN` and `curl -sS http://127.0.0.1:8765/health`.

## Verification checklist

1. **Flask:** `curl -sS http://<host>:<port>/health` → JSON with `"status":"ok"`.
2. **Next env:** `APP_MODE=real`, `FLASK_BASE_URL`, `HIRELENS_INTERNAL_API_KEY` set; restart Next after changes.
3. **Startup logs:** Look for `[hirelens] Flask preflight OK` or the **FAILED** warning.
4. **UI/API:** `POST /api/match/score` — on network failure, expect **503** and `details.flask.kind === "network"`.
5. **Diagnostics page:** `/diagnostics` — pipeline flags should match your intent.

## Operations notes

- **Circuit breaker** is not implemented in-process (serverless has many instances); use your platform’s load balancer health checks and alerts on 503 rate.
- **Silent failure** is avoided: errors are logged, API responses include a structured `flask` object when `FlaskPipelineError` is thrown.

## Merge / production readiness

- **Ready to merge** when CI passes (`npm run lint`, `npm test`) and manual smoke passes: Flask up → preflight OK → match/tailor/impact succeed in `APP_MODE=real`.
- **Serverless (e.g. Vercel):** Route handlers use the **Node** runtime for pipeline calls. Each invocation may cold-start; retries + timeouts cover transient blips. Cross-AZ latency to a long-lived Flask VM is normal — tune `FLASK_FETCH_TIMEOUT_MS`.
- **Deployment patterns**

  | Mode | FLASK_BASE_URL | Flask bind |
  |------|----------------|------------|
  | Local host dev | `http://127.0.0.1:8765` | `python3 app.py` → `0.0.0.0:8765` |
  | Docker Compose | `http://<flask_service>:8765` on shared network | Container `0.0.0.0:8765` |
  | Production (gunicorn) | Internal LB or service DNS + port | `gunicorn -b 0.0.0.0:8765` (or behind sidecar) |

- **Remaining risks:** Flask process crashes mid-request → 503 with classified network/HTTP error; rotate secrets via platform, not this doc.
