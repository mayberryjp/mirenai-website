import { test, expect } from "@playwright/test";

// Smoke test: the dashboard shell renders even if the backend API is unreachable.
test("dashboard loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
