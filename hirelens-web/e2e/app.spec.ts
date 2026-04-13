import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home redirects to dashboard and overview loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  });
});

test.describe("jobs list", () => {
  test("jobs page renders list or empty / error state", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();

    const empty = page.getByRole("heading", { name: "No jobs yet" });
    const loadError = page.getByRole("heading", { name: "Could not load jobs" });
    const firstRow = page.locator("main ul.space-y-3 li").first();

    await expect(empty.or(loadError).or(firstRow)).toBeVisible();
  });
});

test.describe("resumes library", () => {
  test("resume library loads without raw JSON in pre blocks", async ({ page }) => {
    await page.goto("/resumes");
    await expect(page.getByRole("heading", { level: 1, name: "Resume library" })).toBeVisible();

    await expect(page.getByRole("main").locator("pre")).toHaveCount(0);
  });
});
