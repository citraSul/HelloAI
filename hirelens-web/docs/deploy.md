# HireLens Web — deployment runbook

Next.js app in `hirelens-web/`. For local setup, see [`local-development.md`](./local-development.md).

## 1. Recommended deploy path

- **Vercel** (or any Node host that runs `next build` / `next start`).
- In a monorepo, set the Vercel **Root Directory** to `hirelens-web`.
- `next.config.ts` sets `outputFileTracingRoot` to the parent folder (`resume-job-matcher`); keep the repo layout consistent with that when building.

## 2. Required environment variables

Set these in the hosting provider. For **local** dev, put **`DATABASE_URL` in `hirelens-web/.env` only** (Prisma + Next); optional overrides can go in `.env.local` without duplicating `DATABASE_URL`. The canonical template is **`hirelens-web/.env.example`**.

| Variable | Role |
|----------|------|
| `DATABASE_URL` | PostgreSQL connection string for Prisma (required for persistence). |
| `CRON_SECRET` | Non-empty secret for `POST /api/jobs/ingest` (required for ingestion HTTP trigger). |
| `APP_MODE` | `mock` (default) or `real`. |
| `FLASK_BASE_URL` | Required when `APP_MODE=real` (no trailing slash). |
| `HIRELENS_INTERNAL_API_KEY` | Required when `APP_MODE=real`; must match Flask. |
| `NEXT_PUBLIC_APP_NAME` | Optional branding. |
| `NEXT_PUBLIC_API_URL` | Public API base URL for client-side use when configured. |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Optional; Adzuna source fails at runtime if missing (logged); Remote OK can still run. |

Do **not** set `HIRELENS_PIPELINE_DEBUG=1` in production (see `.env.example`).

## 3. Database setup (production)

- Prisma provider is **PostgreSQL** (`prisma/schema.prisma`).
- Checked-in migrations under **`prisma/migrations/`** (apply in this order):
  1. **`20260402100000_init`** — full schema **without** `User.primaryResumeId` (tables, enums, indexes, FKs as of that baseline).
  2. **`20260402120000_add_user_primary_resume`** — adds **`User.primaryResumeId`**, unique index, and FK to `Resume` (`ON DELETE SET NULL`).

Together, **`npx prisma migrate deploy` on an empty database** brings the DB in line with the current `schema.prisma`.

**Apply migrations** (from `hirelens-web/` with `DATABASE_URL` set):

```bash
npm ci
npx prisma migrate deploy
```

### Brand-new empty PostgreSQL

- Run **`migrate deploy`** only (no `db push` required). It applies `init`, then `add_user_primary_resume`.

### Existing database (created earlier with `db push`, no `_prisma_migrations` history)

- **`migrate deploy`** returns **P3005** (“database schema is not empty”) until you baseline.
- Align the live database with **`schema.prisma`** (if anything is missing, run **`npx prisma db push`** once, or apply the missing SQL by hand).
- Record both migrations **without re-running** their SQL, **in this order**:

```bash
npx prisma migrate resolve --applied 20260402100000_init
npx prisma migrate resolve --applied 20260402120000_add_user_primary_resume
```

**Legacy `db push` database that matches `init` but does not have `primaryResumeId` yet:** mark **`init`** as applied (`migrate resolve --applied 20260402100000_init`), then run **`migrate deploy`** — only **`add_user_primary_resume`** runs.

### If you already baselined only `20260402120000_add_user_primary_resume`

- After pulling `20260402100000_init`, **`migrate deploy` will try to run `init` and fail** (tables already exist). Fix by marking the baseline as applied **without running it**:

```bash
npx prisma migrate resolve --applied 20260402100000_init
```

Do **not** run `init`’s SQL on a database that already has those tables.

### Future schema changes

- Add new folders under `prisma/migrations/` (later timestamps) and run **`migrate deploy`** in each environment.

Use a **pooler-friendly** URL on serverless hosts if your provider recommends it (not configured in code).

## 4. Post-deploy validation

1. Open **`GET /diagnostics`** on the deployment base URL (route is dynamic; returns JSON).
2. Confirm `databaseUrlPresent`, `prismaConnected`, and `allRequiredTablesOk` match expectations after schema apply.
3. If using **`APP_MODE=real`**, confirm `pipelineActiveForServices` / no `realModeMismatchMessage` per the JSON.

## 5. Triggering ingestion manually

**Local / dev** (app running, e.g. `http://127.0.0.1:3000`):

```bash
curl -sS -X POST \
  -H "X-Cron-Secret: YOUR_CRON_SECRET" \
  "http://127.0.0.1:3000/api/jobs/ingest"
```

**Production**: same `POST`, replace origin with your HTTPS base URL. Alternative header:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR_DOMAIN/api/jobs/ingest"
```

- If `CRON_SECRET` is unset, the route returns **503**.
- Wrong or missing secret returns **401**.
- **`GET /api/jobs/ingest` returns 405** (method not allowed).

## 6. Scheduling ingestion (external POST)

Use any scheduler that can send **HTTPS POST** on your cadence (e.g. GitHub Actions `schedule`, Upstash QStash, Cronhub, etc.):

- **Method:** `POST`
- **URL:** `https://YOUR_DOMAIN/api/jobs/ingest`
- **Header:** `X-Cron-Secret: <same value as CRON_SECRET>` **or** `Authorization: Bearer <CRON_SECRET>`

Store the secret in the scheduler’s secret store, not in the repo.

## 7. Vercel Cron vs this route

**Vercel Cron** invokes the configured path with **HTTP GET**. The ingest handler only runs sync on **POST** and responds to **GET** with **405**. Native Vercel Cron therefore **does not** trigger `syncJobsFromFeeds` as implemented today. Use an **external POST** scheduler, or add a separate **GET** cron entrypoint later if you want Vercel-managed schedules.
