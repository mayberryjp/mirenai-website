import { test, expect } from "@playwright/test";

// Smoke test: the dashboard shell renders even if the backend API is unreachable.
test("dashboard loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("newly seen domains stay compact and reveal full domains on hover", async ({ page }) => {
  const domain = "a-very-long-newly-seen-domain.example.com";
  await page.route("**/stats/new-domains/recent?*", (route) => route.fulfill({
    json: {
      status: "ok",
      domains: [{
        client: "192.168.1.10",
        domain,
        first_seen: "2026-11-01T10:17:58",
        last_action: "forward",
        last_qtype: "A",
        blocked: false
      }]
    }
  }));
  await page.goto("/");
  const table = page.locator(".recent-domains-card");
  await expect(table.getByText("Newly Seen Domains", { exact: true })).toBeVisible();
  const domainCell = table.getByText(`${domain.slice(0, 25)}...`, { exact: true });
  await expect(domainCell).toBeVisible();
  for (const cell of [
    domainCell,
    table.locator("tbody .date-column"),
    table.locator("tbody td").first().locator("span.text-no-wrap")
  ]) {
    await expect(cell).toHaveCSS("white-space", "nowrap");
  }
  await domainCell.hover();
  await expect(page.getByRole("tooltip")).toHaveText(domain);
});
