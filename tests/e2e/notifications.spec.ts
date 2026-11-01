import { test, expect } from "@playwright/test";
import type { Settings, SettingsUpdate } from "../../src/types/domain";

test("notification settings route masks, saves, restores, disables, and clears Discord configuration", async ({ page }) => {
  const url = "https://discord.com/api/webhooks/123456/TEST_token-1";
  let settings: Settings = {
    cache_enabled: true, cache_max_ttl: 3600, cache_min_ttl: 0, cache_max_entries: 1000,
    forward_timeout: 5, default_action: "forward", ipv6_enabled: true,
    refresh_seconds: 10, query_flush_seconds: 10, log_queries: true, drop_private_ptr: true,
    discord_notifications_enabled: false, discord_webhook_url: "",
    discord_query_types: { A: true, AAAA: true, PTR: true, MX: true, TXT: true }
  };
  const updates: SettingsUpdate[] = [];
  const messages: string[] = [];
  page.on("console", (message) => messages.push(message.text()));
  page.on("pageerror", (error) => messages.push(error.message));
  await page.route("**/settings", async (route) => {
    if (route.request().method() === "PUT") {
      const update: SettingsUpdate = route.request().postDataJSON();
      updates.push(update);
      settings = {
        ...settings, ...update,
        discord_query_types: { ...settings.discord_query_types, ...update.discord_query_types }
      };
    }
    await route.fulfill({ json: { status: "ok", settings } });
  });
  await page.goto("/settings/notifications");
  const field = page.getByLabel("Webhook URL", { exact: true });
  const toggle = page.getByLabel("Enable notifications", { exact: true });
  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(page.getByRole("tab", { name: "Notifications", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(toggle).not.toBeChecked();
  await expect(field).toHaveValue("");
  await expect(field).toHaveAttribute("type", "password");
  await expect(field).toBeEnabled();
  await expect(save).toBeDisabled();

  await toggle.check();
  await save.click();
  await expect(page.locator(".v-alert")).toContainText("A webhook URL is required");
  expect(updates).toHaveLength(0);
  await field.fill("https://example.com/not-discord");
  await save.click();
  await expect(page.locator(".v-alert")).toContainText("Enter a valid HTTPS Discord webhook URL");
  await expect(field).toHaveValue("https://example.com/not-discord");
  expect(updates).toHaveLength(0);

  await field.fill(`  ${url}  `);
  await page.getByRole("button", { name: "Show webhook URL" }).click();
  await expect(field).toHaveAttribute("type", "text");
  await save.click();
  await expect(page.locator(".v-alert")).toHaveText("Notification settings saved");
  expect(updates[0]).toEqual({ discord_notifications_enabled: true, discord_webhook_url: url });
  await expect(field).toHaveValue(url);
  await expect(field).toHaveAttribute("type", "password");

  await page.getByRole("tab", { name: "General", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/general$/);
  await page.getByRole("button", { name: /Save/ }).click();
  await expect(page.locator(".v-alert")).toContainText("Settings saved.");
  expect(updates[1]).not.toHaveProperty("discord_webhook_url");
  expect(updates[1]).not.toHaveProperty("discord_notifications_enabled");
  expect(updates[1]).not.toHaveProperty("discord_query_types");
  await page.getByRole("tab", { name: "Notifications", exact: true }).click();
  await expect(toggle).toBeChecked();
  await expect(field).toHaveValue(url);
  await expect(field).toHaveAttribute("type", "password");

  await toggle.uncheck();
  await save.click();
  await expect(page.locator(".v-alert")).toHaveText("Notification settings saved");
  expect(updates[2]).toEqual({ discord_notifications_enabled: false });
  await expect(field).toHaveValue(url);

  await toggle.check();
  await save.click();
  await expect(page.locator(".v-alert")).toHaveText("Notification settings saved");
  expect(updates[3]).toEqual({ discord_notifications_enabled: true });
  await toggle.uncheck();
  await field.fill("");
  await save.click();
  await expect(page.locator(".v-alert")).toHaveText("Notification settings saved");
  expect(updates[4]).toEqual({ discord_notifications_enabled: false, discord_webhook_url: "" });
  await expect(field).toHaveValue("");

  expect(messages.join("\n")).not.toContain("TEST_token-1");
  const persisted = await page.evaluate(() => ({
    local: { ...localStorage }, session: { ...sessionStorage }
  }));
  expect(JSON.stringify(persisted)).not.toContain("TEST_token-1");
});

test("query-type toggles share one visible searchable grid and save partial flags", async ({ page }) => {
  let queryTypes: Record<string, boolean> = {
    TXT: true, PTR: true, TYPE65280: true, A: true, DNSKEY: true, AAAA: true, MX: true
  };
  const updates: SettingsUpdate[] = [];
  await page.route("**/settings", async (route) => {
    if (route.request().method() === "PUT") {
      const update: SettingsUpdate = route.request().postDataJSON();
      updates.push(update);
      queryTypes = { ...queryTypes, ...update.discord_query_types };
    }
    await route.fulfill({ json: {
      status: "ok",
      settings: {
        discord_notifications_enabled: false, discord_webhook_url: "",
        discord_query_types: queryTypes
      }
    } });
  });
  await page.goto("/settings/notifications");
  await expect(page.getByLabel("Enable notifications", { exact: true })).not.toBeChecked();
  await expect(page.locator(".query-type-grid input")).toHaveCount(7);
  await expect(page.getByRole("heading", { name: "Query types (7)", exact: true })).toBeVisible();
  await expect(page.getByLabel("A", { exact: true })).toBeChecked();
  await expect(page.getByLabel("AAAA (IPv6)", { exact: true })).toBeChecked();
  const ptr = page.getByLabel("PTR (reverse DNS)", { exact: true });
  await expect(ptr).toBeChecked();
  await ptr.uncheck();
  const mx = page.getByLabel("MX", { exact: true });
  await expect(mx).toBeVisible();
  await expect(mx).toBeChecked();
  await mx.uncheck();
  const search = page.getByLabel("Search query types", { exact: true });
  await search.fill("type65");
  await expect(mx).toHaveCount(0);
  const numeric = page.getByLabel("TYPE65280", { exact: true });
  await expect(numeric).toBeChecked();
  await numeric.uncheck();
  await search.fill("no-such-type");
  await expect(page.getByText("No matching query types.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".v-alert")).toHaveText("Notification settings saved");
  expect(updates).toEqual([{ discord_query_types: { PTR: false, MX: false, TYPE65280: false } }]);
  await page.reload();
  await expect(ptr).not.toBeChecked();
  await expect(page.getByLabel("A", { exact: true })).toBeChecked();
  await expect(page.getByLabel("AAAA (IPv6)", { exact: true })).toBeChecked();
  await expect(mx).not.toBeChecked();
  await expect(numeric).not.toBeChecked();
  await expect(page.getByLabel("TXT", { exact: true })).toBeChecked();
  await expect(page.getByLabel("DNSKEY", { exact: true })).toBeChecked();
});

test("global enable selects all types before individual exclusions and reopening retains them", async ({ page }) => {
  let enabled = false;
  let queryTypes: Record<string, boolean> = { A: false, AAAA: false, PTR: false, MX: false, TYPE65280: false };
  const updates: SettingsUpdate[] = [];
  await page.route("**/settings", async (route) => {
    if (route.request().method() === "PUT") {
      const update: SettingsUpdate = route.request().postDataJSON();
      updates.push(update);
      if (update.discord_notifications_enabled !== undefined) enabled = update.discord_notifications_enabled;
      queryTypes = { ...queryTypes, ...update.discord_query_types };
    }
    await route.fulfill({ json: {
      status: "ok", settings: {
        discord_notifications_enabled: enabled,
        discord_webhook_url: "https://discord.com/api/webhooks/123456/TEST_token-3",
        discord_query_types: queryTypes
      }
    } });
  });
  await page.goto("/settings/notifications");
  const search = page.getByLabel("Search query types", { exact: true });
  await search.fill("PTR");
  const toggle = page.getByLabel("Enable notifications", { exact: true });
  await toggle.check();
  const ptr = page.getByLabel("PTR (reverse DNS)", { exact: true });
  await expect(ptr).toBeChecked();
  await search.fill("");
  for (const label of ["A", "AAAA (IPv6)", "PTR (reverse DNS)", "MX", "TYPE65280"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeChecked();
  }
  await ptr.uncheck();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".v-alert")).toHaveText("Notification settings saved");
  expect(updates).toEqual([{
    discord_notifications_enabled: true,
    discord_query_types: { A: true, AAAA: true, MX: true, TYPE65280: true }
  }]);
  await page.reload();
  await expect(toggle).toBeChecked();
  await expect(ptr).not.toBeChecked();
  await toggle.uncheck();
  await expect(ptr).not.toBeChecked();
  await toggle.check();
  await expect(ptr).toBeChecked();
});

test("server validation errors retain the unsaved webhook and do not claim success", async ({ page }) => {
  const url = "https://discordapp.com/api/v10/webhooks/123456/TEST_token-2";
  await page.route("**/settings", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 422,
        json: {
          status: "error", code: "validation_error", error: "Invalid request",
          detail: "discord_webhook_url is required when notifications are enabled"
        }
      });
      return;
    }
    await route.fulfill({ json: {
      status: "ok",
      settings: {
        discord_notifications_enabled: false, discord_webhook_url: "",
        discord_query_types: { A: true, AAAA: true, PTR: true }
      }
    } });
  });
  await page.goto("/settings/notifications");
  const field = page.getByLabel("Webhook URL", { exact: true });
  await field.fill(url);
  await page.getByLabel("Enable notifications", { exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".v-alert")).toContainText(
    "discord_webhook_url is required when notifications are enabled"
  );
  await expect(field).toHaveValue(url);
  await expect(page.getByText("Notification settings saved", { exact: true })).toHaveCount(0);
});
