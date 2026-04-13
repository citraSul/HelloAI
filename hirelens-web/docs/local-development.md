# HireLense local development

## Single dev server (important)

- **Always use** `http://127.0.0.1:3000` — one Next.js dev server only.
- `npm run dev` checks that **port 3000 is free**. If something is already listening, the command **exits with an error** and prints how to stop the other process.
- Do **not** run two `npm run dev` instances (e.g. on 3000 and 3001); that causes confusion and duplicate DB usage.

## App mode (`APP_MODE`)

| Value | Behavior |
|--------|----------|
| `mock` (default) | Match, tailor, and impact use **built-in mocks**. No Flask required. |
| `real` | **Requires** `FLASK_BASE_URL` and `HIRELENS_INTERNAL_API_KEY`. Scoring/tailor/impact call the Python pipeline; if credentials are missing, requests **fail with a clear error** (no silent mock). |

Set in `.env.local`:

```bash
APP_MODE=mock
# or
APP_MODE=real
```

## Database

1. Copy `hirelens-web/.env.example` to `hirelens-web/.env` and set `DATABASE_URL` (replace `__REPLACE_ME__` with your Postgres password). Keep **`DATABASE_URL` only in `.env`** so Prisma (`db:push`) and Next.js use the same value — do not repeat it in `.env.local` (Next loads `.env.local` after `.env` and would override).
2. From `hirelens-web/` apply the schema (creates all tables including **DecisionAnalysis**):

```bash
npm run db:push
```

Checked-in SQL migrations under `prisma/migrations/` are the source of truth for production (`npx prisma migrate deploy` — see [`deploy.md`](./deploy.md)). On a **new empty** database you can use **`npx prisma migrate deploy`** instead of `db:push` to mirror production. Otherwise keep using **`db:push`** for speed, or **`npx prisma migrate dev`** when evolving migrations.

If a table is missing, Dashboard/Analytics may show **sample data** with a banner — use **Diagnostics** to verify. The dev server also **logs a warning** on startup if `DecisionAnalysis` is missing (decision persistence will fail until you run `db:push`).

## Prisma client vs schema

- **`npm install`** runs **`prisma generate`** (`postinstall`).
- **`npm run dev`** runs **`prisma generate`** again (`predev`) so the client matches the schema before starting.
- After **editing `prisma/schema.prisma`**, run **`npm run db:push`** or **`npx prisma migrate dev`**, then **restart** the dev server so the global Prisma singleton picks up changes.

## Mock mode (fastest local setup)

```bash
cd hirelens-web
cp .env.example .env
# Edit .env: set DATABASE_URL (replace __REPLACE_ME__); leave APP_MODE=mock or add .env.local for overrides
npm install
npm run db:push
npm run dev
```

Open `http://127.0.0.1:3000/diagnostics` to confirm DB + mode.

## Real mode (Flask pipeline)

1. Start the Flask API (repo root Python app) on the URL in `FLASK_BASE_URL`.
2. Set the same `HIRELENS_INTERNAL_API_KEY` in Flask and Next (`.env` and/or `.env.local`).
3. Set `APP_MODE=real`.

```bash
npm run dev
```

If credentials are wrong or Flask is down, Score Match / Tailor / Impact return errors instead of silently using mocks.

**Server logs:** Flask HTTP failures are logged as `[HireLens] Flask pipeline failure` or `network error` / `non-JSON` (see `src/lib/flask/client.ts`).

**Pipeline debug (validation):** set `HIRELENS_PIPELINE_DEBUG=1` in `.env.local` and restart Next. Each successful `POST` to match / tailor / impact / decision APIs logs one JSON line prefixed with `[HireLens][pipeline-debug][…]` (IDs, scores, metrics summary). Do not enable in production.

**Playbook:** `docs/REAL_PIPELINE_VALIDATION.md`.

## Clean dev (stale `.next`, missing chunks, weird HMR)

Symptoms: **500** on pages, errors like **`Cannot find module './611.js'`**, UI broken while APIs still respond.

```bash
npm run dev:clean
```

This **deletes `.next`**, runs **`prisma generate`**, checks port **3000**, then starts Next. Use the same command after major dependency or Next upgrades.

**When to run `dev:clean`**

- After pulling git changes that touch Next, webpack, or many components.
- When you see **missing chunk** / **module not found** under `.next`.
- When the app “half works” (API OK, pages 500).

## EMFILE / “too many open files” (Watchpack)

macOS/Linux can hit file descriptor limits; the dev server may log **`EMFILE`** and file watchers may fail.

**Fix (current shell):**

```bash
ulimit -n 10240
npm run dev
```

**Optional polling mode** (slower but fewer watchers):

```bash
export WATCHPACK_POLLING=true
npm run dev
```

`WATCHPACK_POLLING=true` is read in `next.config.ts` to use webpack polling.

## Health checks

- **UI:** `/diagnostics` — DB connection, required tables, env flags (no secrets).
- **JSON:** `GET /api/diagnostics` — same snapshot for scripts.

## Required environment variables

| Variable | Mock mode | Real mode |
|----------|-----------|-----------|
| `DATABASE_URL` | Required | Required |
| `APP_MODE` | Optional (`mock` default) | Set `real` |
| `FLASK_BASE_URL` | Ignored for pipeline | Required with key |
| `HIRELENS_INTERNAL_API_KEY` | Ignored for pipeline | Required with URL |

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| Port 3000 in use | Stop the other terminal’s `npm run dev` or `lsof -ti:3000 \| xargs kill`, then `npm run dev`. |
| Missing chunk / `.next` errors | `npm run dev:clean` |
| Decision persist fails / DecisionAnalysis | `npm run db:push` then restart dev |
| “Database unavailable” on Dashboard | Fix `DATABASE_URL` and PostgreSQL; see Diagnostics |
| Stale Prisma / `undefined` on model | Restart dev; run `npm run db:push` and `npm run dev:clean` if needed |
| REAL mode errors on score/tailor | Flask running? Keys match? See Diagnostics |

## Recovery checklist (app unstable)

1. Stop **all** `next dev` processes.
2. `cd hirelens-web && npm run db:push` (Prisma reads `hirelens-web/.env`; ensure `DATABASE_URL` is set there).
3. `npm run dev:clean`
4. Open `http://127.0.0.1:3000/diagnostics` — all tables should be OK.

## Browser E2E (Playwright)

From `hirelens-web/`:

1. One-time (per machine / after `@playwright/test` upgrades): `npm run test:e2e:install`
2. Run: `npm run test:e2e` — starts `npm run dev` on **127.0.0.1:3000** or reuses an existing server on that port (see `playwright.config.ts` `webServer.reuseExistingServer`).

Tests expect the same **`.env` / `.env.local`** as normal dev (especially **`DATABASE_URL`**) so SSR pages render. Optional UI: `npm run test:e2e:ui`.

The **`e2e/ingest.spec.ts`** flow calls **`POST /api/jobs/ingest`** and needs a non-empty **`CRON_SECRET`** in server env and in the test’s resolution (same file / `process.env`). If ingest cannot reach providers or persist rows, that test **skips** instead of failing.
