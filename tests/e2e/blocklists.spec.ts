import { test, expect } from "@playwright/test";
import type { Blocklist } from "../../src/types/domain";

test("blocklist last updated timestamps stay on one line on desktop and mobile", async ({ page }) => {
  const blocklist: Blocklist = {
    id: 1,
    name: "Example blocklist",
    url: "https://example.com/blocklists/a-long-source-name/domains.txt",
    update_interval_hours: 24,
    enabled: true,
    domain_count: 123456,
    last_downloaded_at: "2026-11-02T11:27:00",
    last_status: "ok: 123456 domains",
    created_at: "2026-11-01T00:00:00",
    updated_at: "2026-11-02T11:27:00"
  };
  await page.route("**/hosts", (route) =>
    route.fulfill({ json: { status: "ok", hosts: [], total: 0 } }));
  await page.route("**/stats/new-domains", (route) =>
    route.fulfill({ json: { status: "ok", stats: [], total: 0 } }));
  await page.route(/\/blocklists(?:\?.*)?$/, (route) => {
    if (route.request().resourceType() === "document") return route.continue();
    return route.fulfill({ json: {
      status: "ok", blocklists: [blocklist, { ...blocklist, id: 2, last_downloaded_at: null }], total: 2
    } });
  });
  await page.route("**/blocklists/size-history?*", (route) =>
    route.fulfill({ json: { status: "ok", size_history: [] } }));
  await page.route("**/blocklists/recent?*", (route) =>
    route.fulfill({ json: { status: "ok", domains: [], total: 0 } }));

  await page.goto("/settings/blocklists");
  const timestamp = page.locator(".date-column").filter({ hasText: "2026-11-02 11:27" });
  for (const width of [1280, 960, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(timestamp).toBeVisible();
    await expect(timestamp).toHaveCSS("white-space", "nowrap");
    await expect.poll(() => timestamp.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getClientRects().length;
    })).toBe(1);
    await expect(page.locator(".date-column").filter({ hasText: /^never$/ })).toBeVisible();
  }
});
