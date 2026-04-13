import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

/**
 * Resolves the same secret the dev server expects for POST /api/jobs/ingest.
 * Order: process.env.CRON_SECRET, then first non-empty CRON_SECRET in hirelens-web/.env.local / .env.
 */
function resolveCronSecret(): string | undefined {
  const fromEnv = process.env.CRON_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const root = process.cwd();
  for (const file of [".env.local", ".env"]) {
    const fp = path.join(root, file);
    if (!existsSync(fp)) continue;
    for (const line of readFileSync(fp, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      if (!t.startsWith("CRON_SECRET=")) continue;
      let v = t.slice("CRON_SECRET=".length).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (v) return v;
    }
  }
  return undefined;
}

test.describe("job feed ingest", () => {
  test("POST /api/jobs/ingest then /jobs shows feed source labeling", async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);

    const secret = resolveCronSecret();
    test.skip(
      !secret,
      "Set CRON_SECRET in hirelens-web/.env or .env.local (non-empty), or export CRON_SECRET — must match the dev server.",
    );

    const ingest = await request.post("/api/jobs/ingest", {
      headers: { "X-Cron-Secret": secret! },
    });

    if (ingest.status() === 503) {
      test.skip(true, "Server returned 503 (CRON_SECRET missing in server env).");
    }
    if (ingest.status() === 401) {
      throw new Error(
        "401 Unauthorized — CRON_SECRET used by the test does not match the running dev server.",
      );
    }

    if (!ingest.ok()) {
      throw new Error(`ingest HTTP ${ingest.status()}: ${await ingest.text()}`);
    }

    const body = (await ingest.json()) as {
      succeeded?: number;
      fetched?: number;
      failed?: number;
      error?: string;
    };

    if ((body.succeeded ?? 0) < 1) {
      test.skip(
        true,
        `Ingest did not persist jobs (succeeded=${body.succeeded}, fetched=${body.fetched}, failed=${body.failed}). Requires outbound network and at least one working feed (e.g. Remote OK).`,
      );
    }

    await page.goto("/jobs");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();

    await expect(page.locator("main ul.space-y-3 li").first()).toBeVisible();

    // Feed rows use title="Imported from job feed" on the source badge (stable, no hardcoded provider titles).
    await expect(page.getByTitle("Imported from job feed").first()).toBeVisible();
  });
});
