# Real pipeline validation (manual)

Use this when proving **Flask-backed** match, tailor, impact, and decision quality on a **local** machine.

## Prerequisites (all required for real mode)

| Requirement | Check |
|-------------|--------|
| PostgreSQL + `DATABASE_URL` | `npm run db:push` succeeded |
| `APP_MODE=real` in `.env.local` | |
| `FLASK_BASE_URL` (no trailing slash) | Flask process listening on that origin |
| `HIRELENS_INTERNAL_API_KEY` | **Same** secret as Flask internal API |
| Flask routes | `POST /api/internal/v2/pipeline`, `POST /api/internal/evaluate-impact` |

Open **`/diagnostics`** in the app:

- **Application mode** → `APP_MODE` should be `real`.
- **Pipeline active (APP_MODE=real + URL + key)** → **OK**. If not, fix env and restart `npm run dev` / `npm start`.
- If **APP_MODE=real** but URL/key missing, you’ll see a **warning** — requests will throw (not fall back to mock).

## Optional: structured server logs

Add to `.env.local`:

```bash
HIRELENS_PIPELINE_DEBUG=1
```

Restart Next.js. On each successful API call, the **server terminal** prints one line per stage:

- `[HireLens][pipeline-debug][match]` — IDs, `matchScore`, `verdict`, `breakdownKeys`
- `[HireLens][pipeline-debug][tailor]` — IDs, `contentLength`, `changeLogCount`, job title
- `[HireLens][pipeline-debug][impact]` — IDs, normalized **metrics** object
- `[HireLens][pipeline-debug][decision]` — `recommendation`, `confidence`, `reasons`, ref IDs

**Flask errors** (down, wrong key, non-JSON): always logged with `[HireLens] Flask pipeline failure` or `network error` / `non-JSON` — no `HIRELENS_PIPELINE_DEBUG` required.

## Test matrix (fixed cases)

| # | Role | Resume profile to pair | JD focus |
|---|------|-------------------------|----------|
| 1 | Backend engineer | Strong API, DB, distributed systems | Python/Go, microservices, Postgres, k8s |
| 2 | Data scientist | ML, Python, SQL, experimentation | Modeling, causal inference, stakeholder communication |
| 3 | Product manager | Roadmaps, metrics, cross-functional | B2B SaaS, discovery, prioritization |
| 4 | Frontend engineer | React/TypeScript, performance, a11y | Design systems, web performance, testing |
| 5 | (optional) DevOps / SRE | CI/CD, observability, on-call | Cloud infra, reliability, automation |

For each case: create a **Job** with a realistic **full JD** (≥400 words) and a **Resume** with intentional **strong**, **partial**, or **weak** fit to test score calibration.

## One full real-mode case (exact steps)

1. **Env:** `APP_MODE=real`, `FLASK_BASE_URL`, `HIRELENS_INTERNAL_API_KEY`; start **Flask**, then **Next** (`npm run dev`).
2. **Verify:** `http://127.0.0.1:3000/diagnostics` → pipeline active **OK**.
3. **Create job** (Jobs) — paste full JD for matrix row #1 (or your choice).
4. **Upload resume** (Resumes) — text that matches or mismatches the JD as planned.
5. **Job detail** — select resume in URL/query if needed → **Score match** (`POST /api/match/score`).
6. **Tailor** — open `/tailor?jobId=…&resumeId=…` or use **Tailor this resume** → **Tailor resume** (`POST /api/resume/tailor`).
7. **Impact** — in Tailor studio, **Evaluate impact** (`POST /api/impact/evaluate`) using the new tailored row.
8. **Decision** — return to **job detail**; the decision card refreshes from `POST /api/decision/evaluate` (or run Tailor flow which triggers it). Capture recommendation + reasons.

**Trustworthy capture:** With `HIRELENS_PIPELINE_DEBUG=1`, copy lines from the **Next server terminal** for each stage; optionally export `AgentRun` / `MatchAnalysis` / `TailoredResume` / `ImpactMetric` / `DecisionAnalysis` from DB for the same IDs.

## Record (per case)

| Field | Where |
|-------|--------|
| Match score + verdict | Job detail hero, `match_analysis` |
| Breakdown | Fit breakdown panels, `breakdown` JSON |
| Tailored text | Tailor studio / `tailored_resume.content` |
| Impact metrics | Impact panel / `impact_metric.metrics` |
| Decision | Decision card / API `decision` object |

## Quality rubric

- Does match score **rank** strong vs weak cases correctly?
- Does tailoring **change** substantive lines vs header-only?
- Are **keywords** from the JD reflected where expected?
- Is apply/maybe/skip **defensible** from the same evidence the user sees?

## Failure log template

| Case | Symptom | Likely layer |
|------|---------|--------------|
| | | match / tailor / impact / decision |
