import { defineConfig, devices } from "@playwright/test";

/**
 * E2E expectations:
 * - Next dev (`npm run dev`) loads env from `hirelens-web/.env` / `.env.local` like any local run.
 * - A working `DATABASE_URL` lets SSR pages render real content; without it, jobs/resumes may show
 *   error empty states — tests still require a visible heading / resilient structure.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    // Reuse `npm run dev` on :3000 when already running (avoids EADDRINUSE when CI=true locally).
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
