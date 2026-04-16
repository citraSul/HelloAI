import { test, expect, type Page } from "@playwright/test";

/** True when `/jobs` loaded rows and the client filter bar mounted; false for empty DB or error states. */
async function hasJobsFilterBar(page: Page) {
  const bar = page.locator("#jobs-search");
  const noJobs = page.getByRole("heading", { name: "No jobs yet" });
  await Promise.race([
    bar.waitFor({ state: "visible", timeout: 15_000 }),
    noJobs.waitFor({ state: "visible", timeout: 15_000 }),
    page.getByRole("heading", { name: "Could not load jobs" }).waitFor({ state: "visible", timeout: 15_000 }),
  ]).catch(() => {});
  return bar.isVisible();
}

test.describe("jobs filters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();
  });

  test("filter controls visible when job list is loaded", async ({ page }) => {
    test.skip(!(await hasJobsFilterBar(page)), "No jobs in DB — filter bar is not rendered.");

    await expect(page.locator("#jobs-search")).toBeVisible();
    await expect(page.getByLabel("Search")).toBeVisible();
    await expect(page.locator("#jobs-sort")).toBeVisible();
    await expect(page.getByLabel("List order")).toBeVisible();
    await expect(page.locator("#jobs-score-filter")).toBeVisible();
    await expect(page.getByLabel("Match status")).toBeVisible();
    await expect(page.locator("#jobs-decision-filter")).toBeVisible();
    await expect(page.getByLabel("Decision")).toBeVisible();
    await expect(page.locator("#jobs-tracking-filter")).toBeVisible();
    await expect(page.getByLabel("Tracked status")).toBeVisible();
  });

  test("search updates URL and yields no-match empty state", async ({ page }) => {
    test.skip(!(await hasJobsFilterBar(page)), "No jobs in DB — filter bar is not rendered.");

    const token = `___e2e_nomatch_${Date.now()}___`;
    await page.locator("#jobs-search").fill(token);

    await page.waitForURL(
      (url) => new URL(url).searchParams.get("q") === token,
      { timeout: 10_000 },
    );

    await expect(page.getByRole("heading", { name: "No matching jobs" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();

    await page.waitForURL(
      (url) => !new URL(url).searchParams.has("q"),
      { timeout: 10_000 },
    );

    await expect(page.locator("main ul.space-y-3 li").first()).toBeVisible();
  });

  test("match status filter updates URL (unscored)", async ({ page }) => {
    test.skip(!(await hasJobsFilterBar(page)), "No jobs in DB — filter bar is not rendered.");

    await page.locator("#jobs-score-filter").selectOption("unscored");

    await page.waitForURL(
      (url) => new URL(url).searchParams.get("score") === "unscored",
      { timeout: 10_000 },
    );

    const hasRows = await page.locator("main ul.space-y-3 li").count();
    const emptyFiltered = page.getByRole("heading", { name: "No matching jobs" });

    if (hasRows > 0) {
      await expect(page.locator("main ul.space-y-3 li").first()).toBeVisible();
    } else {
      await expect(emptyFiltered).toBeVisible();
    }
  });
});
