import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import NotificationsPanel from "@/components/settings/NotificationsPanel.vue";
import GeneralSettingsPanel from "@/components/settings/GeneralSettingsPanel.vue";
import { getSettings, updateSettings } from "@/services/settings";
import type { Settings } from "@/types/domain";

vi.mock("@/services/settings", () => ({
  getSettings: vi.fn(), updateSettings: vi.fn()
}));

const url = "https://discord.com/api/webhooks/123456/TEST_token-1";
const defaults: Settings = {
  cache_enabled: true, cache_max_ttl: 3600, cache_min_ttl: 0, cache_max_entries: 1000,
  forward_timeout: 5, default_action: "forward", ipv6_enabled: true,
  refresh_seconds: 10, query_flush_seconds: 10, log_queries: true, drop_private_ptr: true,
  discord_notifications_enabled: false, discord_webhook_url: "",
  discord_query_types: { TXT: true, AAAA: true, TYPE65280: true, PTR: true, MX: true, A: true, DNSKEY: true }
};
const slotStub = { template: "<div><slot /></div>" };
const stubs = {
  "v-progress-circular": true,
  "v-alert": slotStub,
  "v-form": { template: "<form><slot /></form>" },
  "v-btn": {
    props: ["disabled", "loading"],
    template: "<button :disabled='disabled'><slot /></button>"
  },
  "v-switch": {
    props: ["modelValue", "label", "disabled"],
    emits: ["update:modelValue"],
    template: `<input type="checkbox" :aria-label="label" :checked="modelValue" :disabled="disabled"
      @change="$emit('update:modelValue', $event.target.checked)" />`
  },
  "v-text-field": {
    props: ["modelValue", "label", "type", "disabled"],
    emits: ["update:modelValue"],
    template: `<div><input :type="type" :aria-label="label" :value="modelValue" :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)" /><slot name="append-inner" /></div>`
  },
  "v-select": true,
  "v-divider": true,
  "v-row": slotStub,
  "v-col": slotStub
};

async function render() {
  const wrapper = mount(NotificationsPanel, {
    global: { plugins: [createPinia()], stubs }
  });
  await flushPromises();
  return wrapper;
}
type Panel = Awaited<ReturnType<typeof render>>;

async function save(wrapper: Panel) {
  await wrapper.get("form").trigger("submit");
  await flushPromises();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSettings).mockResolvedValue({ ...defaults });
  vi.mocked(updateSettings).mockImplementation(async (body) => ({
    ...defaults, ...body,
    discord_query_types: { ...defaults.discord_query_types, ...body.discord_query_types }
  }));
});

describe("Discord notification settings", () => {
  it("renders every returned type equally in one alphabetical grid with the total count", async () => {
    const wrapper = await render();
    expect(wrapper.findAll(".query-type-grid input").map((input) =>
      input.attributes("aria-label"))).toEqual([
      "A", "AAAA (IPv6)", "DNSKEY", "MX", "PTR (reverse DNS)", "TXT", "TYPE65280"
    ]);
    expect(wrapper.text()).toContain("Query types (7)");
    expect(wrapper.text()).not.toContain("Additional query types");
    for (const type of ["A", "AAAA (IPv6)", "PTR (reverse DNS)", "MX", "TXT", "DNSKEY", "TYPE65280"]) {
      const input = wrapper.get<HTMLInputElement>(`input[aria-label="${type}"]`);
      expect(input.element.checked).toBe(true);
      expect(input.element.disabled).toBe(false);
    }
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(8);
  });

  it("searches all types without losing hidden unsaved changes or changing the total count", async () => {
    const wrapper = await render();
    await wrapper.get('input[aria-label="MX"]').setValue(false);
    await wrapper.get('input[aria-label="Search query types"]').setValue(" type65 ");
    expect(wrapper.find('input[aria-label="MX"]').exists()).toBe(false);
    expect(wrapper.find('input[aria-label="TYPE65280"]').exists()).toBe(true);
    expect(wrapper.find('input[aria-label="A"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Query types (7)");
    await save(wrapper);
    expect(updateSettings).toHaveBeenCalledWith({ discord_query_types: { MX: false } });
  });

  it("selects every type when globally enabled, including search-hidden types, then allows individual exclusions", async () => {
    const initial: Settings = {
      ...defaults, discord_webhook_url: url,
      discord_query_types: { A: false, AAAA: false, PTR: false, MX: false, TYPE65280: false }
    };
    vi.mocked(getSettings).mockResolvedValue(initial);
    vi.mocked(updateSettings).mockImplementation(async (body) => ({
      ...initial, ...body,
      discord_query_types: { ...initial.discord_query_types, ...body.discord_query_types }
    }));
    const wrapper = await render();
    await wrapper.get('input[aria-label="Search query types"]').setValue("PTR");
    await wrapper.get('input[aria-label="Enable notifications"]').setValue(true);
    expect(wrapper.get<HTMLInputElement>('input[aria-label="PTR (reverse DNS)"]').element.checked).toBe(true);
    await wrapper.get('input[aria-label="Search query types"]').setValue("");
    for (const input of wrapper.findAll<HTMLInputElement>(".query-type-grid input")) {
      expect(input.element.checked).toBe(true);
    }
    await wrapper.get('input[aria-label="PTR (reverse DNS)"]').setValue(false);
    await save(wrapper);
    expect(updateSettings).toHaveBeenCalledWith({
      discord_notifications_enabled: true,
      discord_query_types: { A: true, AAAA: true, MX: true, TYPE65280: true }
    });
    expect(wrapper.get<HTMLInputElement>('input[aria-label="PTR (reverse DNS)"]').element.checked).toBe(false);
  });

  it("does not reset saved exclusions on load or disable, but selects all again on re-enable", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      ...defaults, discord_notifications_enabled: true,
      discord_query_types: { A: true, PTR: false }
    });
    const wrapper = await render();
    const ptr = wrapper.get<HTMLInputElement>('input[aria-label="PTR (reverse DNS)"]');
    expect(ptr.element.checked).toBe(false);
    await wrapper.get('input[aria-label="Enable notifications"]').setValue(false);
    expect(ptr.element.checked).toBe(false);
    await wrapper.get('input[aria-label="Enable notifications"]').setValue(true);
    expect(ptr.element.checked).toBe(true);
    expect(wrapper.get<HTMLInputElement>('input[aria-label="A"]').element.checked).toBe(true);
  });

  it("saves only changed PTR and numeric flags, adopting the full returned map and restoring on reopen", async () => {
    const returned = {
      ...defaults, discord_query_types: { ...defaults.discord_query_types, PTR: false, TYPE65280: false }
    };
    vi.mocked(updateSettings).mockResolvedValue(returned);
    const wrapper = await render();
    await wrapper.get('input[aria-label="PTR (reverse DNS)"]').setValue(false);
    await wrapper.get('input[aria-label="TYPE65280"]').setValue(false);
    await save(wrapper);
    expect(updateSettings).toHaveBeenCalledWith({
      discord_query_types: { PTR: false, TYPE65280: false }
    });
    expect(wrapper.get<HTMLInputElement>('input[aria-label="A"]').element.checked).toBe(true);
    expect(wrapper.get<HTMLInputElement>('input[aria-label="AAAA (IPv6)"]').element.checked).toBe(true);
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Notification settings saved");
    wrapper.unmount();
    vi.mocked(getSettings).mockResolvedValue(returned);
    const reopened = await render();
    expect(reopened.get<HTMLInputElement>('input[aria-label="PTR (reverse DNS)"]').element.checked).toBe(false);
    expect(reopened.get<HTMLInputElement>('input[aria-label="TYPE65280"]').element.checked).toBe(false);
    expect(reopened.get<HTMLInputElement>('input[aria-label="MX"]').element.checked).toBe(true);
  });

  it("adopts server-returned flags rather than assuming the submitted flags were saved", async () => {
    vi.mocked(updateSettings).mockResolvedValue(defaults);
    const wrapper = await render();
    await wrapper.get('input[aria-label="A"]').setValue(false);
    await save(wrapper);
    expect(wrapper.get<HTMLInputElement>('input[aria-label="A"]').element.checked).toBe(true);
    expect(wrapper.text()).toContain("Notification settings saved");
  });

  it("allows all returned flags to be disabled without enabling global notifications", async () => {
    const wrapper = await render();
    const changes: Record<string, boolean> = {};
    for (const input of wrapper.findAll('input[type="checkbox"]').slice(1)) {
      await input.setValue(false);
    }
    for (const type of Object.keys(defaults.discord_query_types)) changes[type] = false;
    await save(wrapper);
    expect(updateSettings).toHaveBeenCalledWith({ discord_query_types: changes });
    expect(wrapper.text()).toContain("Notification settings saved");
  });

  it("does not save reverted flags or send an empty map", async () => {
    const wrapper = await render();
    await wrapper.get('input[aria-label="A"]').setValue(false);
    await wrapper.get('input[aria-label="A"]').setValue(true);
    await save(wrapper);
    expect(updateSettings).not.toHaveBeenCalled();
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
  });

  it("retains all unsaved flags and URL on an atomic API validation failure", async () => {
    vi.mocked(updateSettings).mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: {
        code: "validation_error", error: "Invalid request", detail: "Invalid query-type flags"
      } }
    });
    const wrapper = await render();
    await wrapper.get('input[aria-label="A"]').setValue(false);
    await wrapper.get('input[aria-label="Webhook URL"]').setValue(url);
    await save(wrapper);
    expect(updateSettings).toHaveBeenCalledWith({
      discord_webhook_url: url, discord_query_types: { A: false }
    });
    expect(wrapper.get<HTMLInputElement>('input[aria-label="A"]').element.checked).toBe(false);
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Webhook URL"]').element.value).toBe(url);
    expect(wrapper.text()).toContain("Invalid query-type flags");
    expect(wrapper.text()).not.toContain("Notification settings saved");
  });

  it("loads fresh defaults, masks the editable URL, and supports reveal", async () => {
    const wrapper = await render();
    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(false);
    const field = wrapper.get<HTMLInputElement>('input[aria-label="Webhook URL"]');
    expect(field.element.value).toBe("");
    expect(field.attributes("type")).toBe("password");
    expect(field.element.disabled).toBe(false);
    await wrapper.get('button[aria-label="Show webhook URL"]').trigger("click");
    expect(field.attributes("type")).toBe("text");
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
  });

  it("trims and saves only changed fields, adopting returned settings and restoring on reopen", async () => {
    vi.mocked(updateSettings).mockResolvedValue({
      ...defaults, discord_webhook_url: url, discord_notifications_enabled: false
    });
    const wrapper = await render();
    await wrapper.get('input[aria-label="Webhook URL"]').setValue(`  ${url}  `);
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await save(wrapper);
    expect(updateSettings).toHaveBeenCalledWith({
      discord_webhook_url: url, discord_notifications_enabled: true
    });
    expect(wrapper.text()).toContain("Notification settings saved");
    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(false);
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Webhook URL"]').element.value).toBe(url);
    wrapper.unmount();
    vi.mocked(getSettings).mockResolvedValue({
      ...defaults, discord_webhook_url: url, discord_notifications_enabled: true
    });
    const reopened = await render();
    expect(reopened.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true);
    expect(reopened.get<HTMLInputElement>('input[aria-label="Webhook URL"]').element.value).toBe(url);
  });

  it("enables with a saved URL without resubmitting it", async () => {
    vi.mocked(getSettings).mockResolvedValue({ ...defaults, discord_webhook_url: url });
    const wrapper = await render();
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await save(wrapper);
    expect(updateSettings).toHaveBeenCalledWith({ discord_notifications_enabled: true });
  });

  it.each([false, true])("disables with clear=%s in one request", async (clear) => {
    vi.mocked(getSettings).mockResolvedValue({
      ...defaults, discord_webhook_url: url, discord_notifications_enabled: true
    });
    const wrapper = await render();
    await wrapper.get('input[type="checkbox"]').setValue(false);
    if (clear) await wrapper.get('input[aria-label="Webhook URL"]').setValue("");
    await save(wrapper);
    expect(updateSettings).toHaveBeenCalledWith({
      discord_notifications_enabled: false, ...(clear ? { discord_webhook_url: "" } : {})
    });
  });

  it.each([
    "http://discord.com/api/webhooks/123/token",
    "https://discord.com.evil.example/api/webhooks/123/token",
    "https://user@discord.com/api/webhooks/123/token",
    "https://discord.com:443/api/webhooks/123/token",
    "https://discord.com/api/webhooks/abc/token",
    "https://discord.com/api/webhooks/123/token/",
    "https://discord.com/api/webhooks/123/token?wait=true",
    "https://discord.com/api/webhooks/123/token#fragment",
    "https://discord.com/api/webhooks/123/token!"
  ])("rejects invalid URL %s without discarding input", async (invalid) => {
    const wrapper = await render();
    await wrapper.get('input[aria-label="Webhook URL"]').setValue(invalid);
    await save(wrapper);
    expect(updateSettings).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Enter a valid HTTPS Discord webhook URL");
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Webhook URL"]').element.value).toBe(invalid);
    expect(wrapper.text()).not.toContain("Notification settings saved");
  });

  it.each([
    "https://discordapp.com/api/webhooks/123/TEST_token-1",
    "https://discord.com/api/v10/webhooks/123/TEST_token-1"
  ])("accepts supported webhook format %s", async (valid) => {
    const wrapper = await render();
    await wrapper.get('input[aria-label="Webhook URL"]').setValue(valid);
    await save(wrapper);
    expect(updateSettings).toHaveBeenCalledWith({ discord_webhook_url: valid });
  });

  it("requires a URL to enable and refuses to clear while enabled", async () => {
    const wrapper = await render();
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await save(wrapper);
    expect(updateSettings).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("A webhook URL is required");
    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true);
  });

  it("retains the enabled state when attempting to clear an enabled webhook", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      ...defaults, discord_webhook_url: url, discord_notifications_enabled: true
    });
    const wrapper = await render();
    await wrapper.get('input[aria-label="Webhook URL"]').setValue("");
    await save(wrapper);
    expect(updateSettings).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Disable notifications to clear it");
    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true);
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Webhook URL"]').element.value).toBe("");
  });

  it("retains input and renders API validation detail without hiding the form", async () => {
    vi.mocked(updateSettings).mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: {
        code: "validation_error", error: "Invalid request", detail: "Notifications cannot be enabled"
      } }
    });
    const wrapper = await render();
    await wrapper.get('input[aria-label="Webhook URL"]').setValue(url);
    await save(wrapper);
    expect(wrapper.text()).toContain("Notifications cannot be enabled");
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Webhook URL"]').element.value).toBe(url);
    expect(wrapper.text()).not.toContain("Notification settings saved");
  });

  it("locks the form while saving and shows success only after the response", async () => {
    let resolve: (settings: Settings) => void = () => { throw new Error("Save not started"); };
    vi.mocked(updateSettings).mockReturnValue(new Promise<Settings>((done) => { resolve = done; }));
    const wrapper = await render();
    await wrapper.get('input[aria-label="Webhook URL"]').setValue(url);
    await wrapper.get("form").trigger("submit");
    expect(wrapper.get<HTMLInputElement>('input[aria-label="Webhook URL"]').element.disabled).toBe(true);
    expect(wrapper.text()).not.toContain("Notification settings saved");
    resolve({ ...defaults, discord_webhook_url: url });
    await flushPromises();
    expect(wrapper.text()).toContain("Notification settings saved");
  });

  it("shows load errors and retries without presenting editable defaults", async () => {
    vi.mocked(getSettings).mockRejectedValueOnce(new Error("Settings unavailable"));
    const wrapper = await render();
    expect(wrapper.text()).toContain("Settings unavailable");
    expect(wrapper.find("form").exists()).toBe(false);
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.find("form").exists()).toBe(true);
  });

  it("keeps General settings saves from resubmitting notification configuration", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      ...defaults, discord_webhook_url: url, discord_notifications_enabled: true
    });
    const wrapper = mount(GeneralSettingsPanel, { global: { plugins: [createPinia()], stubs } });
    await flushPromises();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    const body = vi.mocked(updateSettings).mock.calls[0][0];
    expect(body).not.toHaveProperty("discord_webhook_url");
    expect(body).not.toHaveProperty("discord_notifications_enabled");
    expect(body).not.toHaveProperty("discord_query_types");
    expect(body).toHaveProperty("default_action", "forward");
  });
});
