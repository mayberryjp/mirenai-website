import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia } from "pinia";
import { flushPromises, mount } from "@vue/test-utils";
import UpstreamsPanel from "@/components/settings/UpstreamsPanel.vue";
import { createUpstream, listUpstreams, updateUpstream } from "@/services/upstreams";
import { getUpstreamRttStats } from "@/services/stats";
import type { Upstream } from "@/types/domain";

vi.mock("@/services/upstreams", () => ({
  listUpstreams: vi.fn(),
  createUpstream: vi.fn(),
  updateUpstream: vi.fn(),
  deleteUpstream: vi.fn(),
  checkUpstream: vi.fn()
}));
vi.mock("@/services/stats", () => ({ getUpstreamRttStats: vi.fn() }));

const upstream: Upstream = {
  id: 1, name: null, address: "1.1.1.1", port: 53, protocol: "tcp",
  use_tls: false, tls_server_name: null, enabled: true, priority: 100,
  created_at: "", updated_at: ""
};
const slotStub = { template: "<div><slot /></div>" };
const textField = {
  props: {
    modelValue: { type: [String, Number], required: true },
    label: { type: String, required: true }
  },
  emits: ["update:modelValue"],
  template: `<input :aria-label="label" :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)" />`
};
const switchStub = {
  props: {
    modelValue: Boolean,
    label: { type: String, required: true }
  },
  emits: ["update:modelValue"],
  template: `<input type="checkbox" :aria-label="label" :checked="modelValue"
    @change="$emit('update:modelValue', $event.target.checked)" />`
};

async function render(items: Upstream[] = []) {
  vi.mocked(listUpstreams).mockResolvedValue({ items, total: items.length });
  const wrapper = mount(UpstreamsPanel, {
    global: {
      plugins: [createPinia()],
      stubs: {
        UpstreamRttChart: true,
        AsyncState: slotStub,
        "v-card": slotStub,
        "v-card-title": slotStub,
        "v-card-text": slotStub,
        "v-card-actions": slotStub,
        "v-alert": slotStub,
        "v-chip": slotStub,
        "v-spacer": true,
        "v-icon": true,
        "v-tooltip": true,
        "v-dialog": {
          props: ["modelValue"],
          template: "<div v-if='modelValue'><slot /></div>"
        },
        "v-btn": {
          props: ["icon"],
          template: "<button :aria-label='icon'><slot /></button>"
        },
        "v-text-field": textField,
        "v-switch": switchStub,
        "v-data-table": {
          props: ["items"],
          template: `<div><div v-for="item in items" :key="item.id">
            <slot name="item.address" :item="item" />
            <slot name="item.actions" :item="item" />
          </div></div>`
        }
      }
    }
  });
  await flushPromises();
  return wrapper;
}

type Panel = Awaited<ReturnType<typeof render>>;

async function click(wrapper: Panel, text: string) {
  const button = wrapper.findAll("button").find((item) => item.text() === text);
  if (!button) throw new Error(`Button not found: ${text}`);
  await button.trigger("click");
  await flushPromises();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getUpstreamRttStats).mockResolvedValue([]);
  vi.mocked(createUpstream).mockResolvedValue(upstream);
  vi.mocked(updateUpstream).mockResolvedValue(upstream);
});

describe("upstream TLS settings", () => {
  it("creates plain DNS upstreams with the existing defaults", async () => {
    const wrapper = await render();
    await click(wrapper, "New Upstream DNS Server");
    await wrapper.get('[aria-label="Address (IP)"]').setValue("1.1.1.1");
    await click(wrapper, "Save");
    expect(createUpstream).toHaveBeenCalledWith({
      address: "1.1.1.1", port: 53, protocol: "udp", use_tls: false,
      tls_server_name: null, enabled: true, priority: 100
    });
  });

  it("requires a nonblank server name and creates TLS upstreams on port 853", async () => {
    const wrapper = await render();
    await click(wrapper, "New Upstream DNS Server");
    await wrapper.get('[aria-label="Address (IP)"]').setValue("1.1.1.1");
    await wrapper.get('[aria-label="DNS over TLS"]').setValue(true);
    expect(wrapper.get<HTMLInputElement>('[aria-label="Port"]').element.value).toBe("853");
    await wrapper.get('[aria-label="TLS server name (required)"]').setValue("   ");
    await click(wrapper, "Save");
    expect(createUpstream).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("TLS server name is required");
    await wrapper.get('[aria-label="TLS server name (required)"]').setValue(" cloudflare-dns.com ");
    await click(wrapper, "Save");
    expect(createUpstream).toHaveBeenCalledWith(expect.objectContaining({
      port: 853, use_tls: true, tls_server_name: "cloudflare-dns.com"
    }));
  });

  it("explicitly updates the port when enabling TLS and preserves the protocol", async () => {
    const wrapper = await render([upstream]);
    await wrapper.get('[aria-label="mdi-pencil"]').trigger("click");
    await wrapper.get('[aria-label="DNS over TLS"]').setValue(true);
    await wrapper.get('[aria-label="TLS server name (required)"]').setValue("cloudflare-dns.com");
    await click(wrapper, "Save");
    expect(updateUpstream).toHaveBeenCalledWith(1, expect.objectContaining({
      port: 853, protocol: "tcp", use_tls: true, tls_server_name: "cloudflare-dns.com"
    }));
  });

  it("loads existing TLS settings and can disable TLS with port 53", async () => {
    const wrapper = await render([{
      ...upstream, port: 853, use_tls: true, tls_server_name: "cloudflare-dns.com"
    }]);
    expect(wrapper.text()).toContain("TLS");
    await wrapper.get('[aria-label="mdi-pencil"]').trigger("click");
    expect(wrapper.get<HTMLInputElement>('[aria-label="DNS over TLS"]').element.checked).toBe(true);
    expect(wrapper.get<HTMLInputElement>('[aria-label="TLS server name (required)"]').element.value)
      .toBe("cloudflare-dns.com");
    await wrapper.get('[aria-label="DNS over TLS"]').setValue(false);
    await click(wrapper, "Save");
    expect(updateUpstream).toHaveBeenCalledWith(1, expect.objectContaining({
      port: 53, use_tls: false, tls_server_name: null
    }));
  });

  it("preserves custom ports when toggling TLS", async () => {
    const wrapper = await render([{ ...upstream, port: 8853 }]);
    await wrapper.get('[aria-label="mdi-pencil"]').trigger("click");
    await wrapper.get('[aria-label="DNS over TLS"]').setValue(true);
    expect(wrapper.get<HTMLInputElement>('[aria-label="Port"]').element.value).toBe("8853");
    await wrapper.get('[aria-label="DNS over TLS"]').setValue(false);
    expect(wrapper.get<HTMLInputElement>('[aria-label="Port"]').element.value).toBe("8853");
    await click(wrapper, "Save");
    expect(updateUpstream).toHaveBeenCalledWith(1, expect.objectContaining({ port: 8853 }));
  });

  it("preserves existing TLS configuration when saving other fields", async () => {
    const wrapper = await render([{
      ...upstream, port: 8853, use_tls: true, tls_server_name: "cloudflare-dns.com"
    }]);
    await wrapper.get('[aria-label="mdi-pencil"]').trigger("click");
    await wrapper.get('[aria-label="Priority (lower = first)"]').setValue("50");
    await click(wrapper, "Save");
    expect(updateUpstream).toHaveBeenCalledWith(1, expect.objectContaining({
      port: 8853, use_tls: true, tls_server_name: "cloudflare-dns.com", priority: 50
    }));
  });

  it("resets TLS settings when opening a new upstream after editing", async () => {
    const wrapper = await render([{
      ...upstream, port: 853, use_tls: true, tls_server_name: "cloudflare-dns.com"
    }]);
    await wrapper.get('[aria-label="mdi-pencil"]').trigger("click");
    await click(wrapper, "Cancel");
    await click(wrapper, "New Upstream DNS Server");
    expect(wrapper.get<HTMLInputElement>('[aria-label="DNS over TLS"]').element.checked).toBe(false);
    expect(wrapper.get<HTMLInputElement>('[aria-label="Port"]').element.value).toBe("53");
    expect(wrapper.find('[aria-label="TLS server name (required)"]').exists()).toBe(false);
  });

  it("surfaces backend errors without closing the dialog", async () => {
    vi.mocked(createUpstream).mockRejectedValue(new Error("TLS configuration rejected"));
    const wrapper = await render();
    await click(wrapper, "New Upstream DNS Server");
    await click(wrapper, "Save");
    expect(wrapper.text()).toContain("TLS configuration rejected");
    expect(wrapper.get('[aria-label="Address (IP)"]').exists()).toBe(true);
  });
});
