import { test, expect } from "@playwright/test";
import type { Policy, PolicyCreate } from "../../src/types/domain";

test("policy denied route shows hourly traffic, locally pages ranked domains, and edits each client's policy", async ({ page }) => {
  let policies: Policy[] = [];
  const writes: { method: string; body: PolicyCreate | null }[] = [];
  const deniedReads: string[] = [];
  await page.route("**/hosts", (route) => route.fulfill({ json: {
    status: "ok", hosts: [{
      ip: "192.168.1.10", device_name: "Living Room", query_count: 100
    }, { ip: "192.168.1.11", device_name: "Bedroom", query_count: 40 }], total: 2
  } }));
  await page.route("**/stats/new-domains", (route) =>
    route.fulfill({ json: { status: "ok", stats: [], total: 0 } }));
  await page.route("**/stats/site?*", (route) => route.fulfill({ json: {
    status: "ok", stats: [
      { hour_start: "2026-11-01T10:00:00", denied: 123, blocked: 999, total: 2000 },
      { hour_start: "2026-11-01T09:00:00", denied: 0, blocked: 999, total: 2000 }
    ], total: 2
  } }));
  await page.route("**/queries/top-denied?*", (route) => {
    deniedReads.push(route.request().url());
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("limit")).toBe("100");
    expect(params.has("offset")).toBe(false);
    return route.fulfill({ json: {
      status: "ok", total: 26,
      domains: Array.from({ length: 26 }, (_, index) => ({
        domain: `denied-${index}.example.com`,
        count: 100 - index,
        clients: index === 0
          ? [{ client: "192.168.1.10", count: 60 }, { client: "192.168.1.11", count: 40 }]
          : [{ client: "192.168.1.10", count: 100 - index }],
        first_seen: "2026-11-01T02:15:00", last_seen: "2026-11-01T10:30:00"
      }))
    } });
  });
  await page.route(/\/policies(?:\/\d+)?(?:\?.*)?$/, (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({ json: { status: "ok", policies, total: policies.length } });
    }
    const body: PolicyCreate | null = method === "DELETE" ? null : route.request().postDataJSON();
    writes.push({ method, body });
    if (method === "DELETE") {
      policies = [];
      return route.fulfill({ json: { status: "ok", deleted: 1 } });
    }
    if (!body) throw new Error("Missing policy body");
    const saved: Policy = {
      id: 1, override_response: null, override_ttl: 300, enabled: true,
      description: null, created_at: "", updated_at: "", ...body
    };
    policies = [saved];
    return route.fulfill({ json: { status: "ok", policy: saved } });
  });

  await page.goto("/settings/policy-denied");
  await expect(page.getByRole("tab", { name: "Policy Denied", exact: true }))
    .toHaveAttribute("aria-selected", "true");
  const tabs = (await page.getByRole("tab").allTextContents()).map((text) => text.trim());
  expect(tabs.indexOf("Policy Denied")).toBe(tabs.indexOf("Blocklist Activity") + 1);
  expect(tabs.indexOf("Spoofed")).toBe(tabs.indexOf("Policy Denied") + 1);
  const hourly = page.locator(".blocklist-traffic-card");
  await expect(hourly.getByText("Policy Denied Traffic", { exact: true })).toBeVisible();
  await expect(hourly.locator(".apexcharts-line-series")).toBeVisible();
  await expect(hourly.getByText("Policy denials / hour", { exact: true })).toBeVisible();
  const first = page.getByRole("row").filter({ hasText: "denied-0.example.com" });
  await expect(first).toContainText("Living Room");
  await expect(first).toContainText("Bedroom");
  await expect(first).not.toContainText("(60)");
  await expect(first).not.toContainText("(40)");
  await expect(first.getByRole("cell", { name: "100", exact: true })).toBeVisible();
  await expect(first).toContainText("11/01 02:15");
  await expect(first).toContainText("11/01 10:30");
  await expect(first).toContainText("Policy Denied");

  const clientLink = first.getByRole("link", { name: "Living Room", exact: true });
  await expect(clientLink).toHaveAttribute("href", "/clients/192.168.1.10");
  const surroundingStyle = await clientLink.evaluate((link) => {
    if (!link.parentElement) throw new Error("Client link has no parent");
    const style = getComputedStyle(link.parentElement);
    return { color: style.color, font: style.font };
  });
  await expect(clientLink).toHaveCSS("color", surroundingStyle.color);
  await expect(clientLink).toHaveCSS("font", surroundingStyle.font);
  await expect(clientLink).toHaveCSS("text-decoration-line", "none");
  await clientLink.hover();
  await expect(clientLink).toHaveCSS("color", surroundingStyle.color);
  await expect(clientLink).toHaveCSS("text-decoration-line", "none");
  await clientLink.focus();
  await expect(clientLink).toHaveCSS("color", surroundingStyle.color);
  await expect(clientLink).toHaveCSS("text-decoration-line", "none");

  const editor = first.locator(".policy-control").first();
  await expect(first.locator(".policy-control")).toHaveCount(2);
  await editor.getByRole("button", { name: "Inherit", exact: true }).click();
  await page.getByRole("listitem").filter({ hasText: /^Allow$/ }).click();
  await expect(editor.getByRole("button", { name: "Allow", exact: true })).toBeVisible();
  await expect(first.locator(".policy-control").last().getByRole("button", { name: "Inherit", exact: true })).toBeVisible();
  expect(writes[0]).toEqual({ method: "POST", body: {
    client: "192.168.1.10", domain: "denied-0.example.com",
    action: "forward", override_response: null
  } });
  await editor.getByRole("button", { name: "Allow", exact: true }).click();
  await page.getByRole("listitem").filter({ hasText: /^Block$/ }).click();
  await expect(editor.getByRole("button", { name: "Block", exact: true })).toBeVisible();
  expect(writes[1].method).toBe("PUT");
  expect(writes[1].body?.action).toBe("deny");
  await editor.getByRole("button", { name: "Block", exact: true }).click();
  await page.getByRole("listitem").filter({ hasText: /^Spoof$/ }).click();
  await page.getByPlaceholder("Response (IP / name)").fill("192.0.2.53");
  await page.getByRole("button", { name: "Save spoof response", exact: true }).click();
  await expect(editor.getByRole("button", { name: /Spoof/ })).toContainText("192.0.2.53");
  expect(writes[2].body?.override_response).toBe("192.0.2.53");
  await editor.getByRole("button", { name: /Spoof/ }).click();
  await page.getByRole("listitem").filter({ hasText: /^Inherit$/ }).click();
  await expect(editor.getByRole("button", { name: "Inherit", exact: true })).toBeVisible();
  expect(writes[3].method).toBe("DELETE");
  await expect(first).toContainText("Policy Denied");

  await page.getByRole("button", { name: "Next page" }).last().click();
  await expect(page.getByRole("cell", { name: "denied-25.example.com", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "denied-0.example.com", exact: true })).toHaveCount(0);
  expect(deniedReads).toHaveLength(1);
});

test("missing denied endpoint surfaces an error without hiding hourly traffic on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/hosts", (route) => route.fulfill({ json: { status: "ok", hosts: [], total: 0 } }));
  await page.route("**/policies", (route) => route.fulfill({ json: { status: "ok", policies: [], total: 0 } }));
  await page.route("**/stats/new-domains", (route) => route.fulfill({ json: { status: "ok", stats: [], total: 0 } }));
  await page.route("**/stats/site?*", (route) => route.fulfill({ json: {
    status: "ok", stats: [{ hour_start: "2026-11-01T10:00:00", denied: 17 }], total: 1
  } }));
  await page.route("**/queries/top-denied?*", (route) =>
    route.fulfill({ status: 404, json: { status: "error", code: "not_found", message: "Denied traffic unavailable" } }));
  await page.goto("/settings/policy-denied");
  await expect(page.locator(".v-alert")).toBeVisible();
  await expect(page.getByText("Policy Denied Traffic", { exact: true })).toBeVisible();
  await expect(page.locator(".apexcharts-line-series")).toBeVisible();
  const overflows = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth);
  expect(overflows).toBe(false);
});
