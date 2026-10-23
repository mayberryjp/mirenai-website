import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import SpoofedPanel from "@/components/settings/SpoofedPanel.vue";
import TrafficChart from "@/components/dashboard/BlocklistTrafficChart.vue";
import PolicyMenu from "@/components/base/PolicyMenu.vue";
import { deletePolicy, listPolicies, updatePolicy } from "@/services/policies";
import { getSiteStats } from "@/services/stats";
import type { Policy, SiteHourlyStat } from "@/types/domain";

vi.mock("@/services/policies", () => ({
  listPolicies: vi.fn(), updatePolicy: vi.fn(), deletePolicy: vi.fn()
}));
vi.mock("@/services/stats", () => ({ getSiteStats: vi.fn() }));

const rule: Policy = {
  id: 42, client: "*", domain: "service.example.com", action: "override",
  override_response: "10.0.0.53,fd00::53", override_ttl: 300, enabled: false,
  description: "Internal service", created_at: "", updated_at: ""
};
const slotStub = { template: "<div><slot /></div>" };
const fieldStub = {
  props: ["modelValue", "label"],
  emits: ["update:modelValue"],
  template: `<input :aria-label="label" :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)" />`
};

async function render() {
  const wrapper = mount(SpoofedPanel, {
    global: {
      stubs: {
        BlocklistTrafficChart: true,
        PolicyMenu: true,
        "v-sheet": slotStub,
        "v-card": slotStub,
        "v-card-title": slotStub,
        "v-card-text": slotStub,
        "v-card-actions": slotStub,
        "v-alert": slotStub,
        "v-spacer": true,
        "v-dialog": {
          props: ["modelValue"], template: "<div v-if='modelValue'><slot /></div>"
        },
        "v-btn": { template: "<button><slot /></button>" },
        "v-text-field": fieldStub,
        "v-textarea": fieldStub,
        "v-switch": {
          props: ["modelValue", "label"],
          emits: ["update:modelValue"],
          template: `<input type="checkbox" :aria-label="label" :checked="modelValue"
            @change="$emit('update:modelValue', $event.target.checked)" />`
        },
        "v-data-table-server": {
          name: "v-data-table-server",
          props: ["items", "itemsLength", "page"],
          emits: ["update:page", "update:itemsPerPage"],
          template: `<div><div v-for="item in items" :key="item.id">
            {{ item.domain }}
            <slot name="item.policy" :item="item" />
            <slot name="item.enabled" :item="item" />
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
  vi.mocked(listPolicies).mockResolvedValue({ items: [rule], total: 31 });
  vi.mocked(getSiteStats).mockResolvedValue([]);
  vi.mocked(updatePolicy).mockResolvedValue(rule);
  vi.mocked(deletePolicy).mockResolvedValue(rule.id);
});

describe("spoofed settings", () => {
  it("loads 100-hour traffic and filtered rules, including disabled rules", async () => {
    const wrapper = await render();
    expect(getSiteStats).toHaveBeenCalledWith(100);
    expect(listPolicies).toHaveBeenCalledWith(25, 0, "override");
    expect(wrapper.text()).toContain(rule.domain);
    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(false);
    expect(wrapper.findComponent(TrafficChart).props("result")).toBe("overridden");
  });

  it("requests subsequent server pages and preserves the filtered total", async () => {
    const wrapper = await render();
    const table = wrapper.findComponent({ name: "v-data-table-server" });
    table.vm.$emit("update:page", 2);
    await flushPromises();
    expect(listPolicies).toHaveBeenLastCalledWith(25, 25, "override");
    expect(table.props("itemsLength")).toBe(31);
  });

  it("offers editing existing rules without a new spoof rule button", async () => {
    const wrapper = await render();
    expect(wrapper.findAll("button").some((button) => button.text() === "New spoof rule")).toBe(false);
    expect(wrapper.find('[aria-label="Edit spoof rule"]').exists()).toBe(true);
  });

  it("edits existing rule fields without losing disabled state or description", async () => {
    const wrapper = await render();
    await wrapper.get('[aria-label="Edit spoof rule"]').trigger("click");
    await wrapper.get('[aria-label="TTL (seconds)"]').setValue("600");
    await click(wrapper, "Save");
    expect(updatePolicy).toHaveBeenCalledWith(42, {
      client: "*", domain: rule.domain, action: "override",
      override_response: rule.override_response, override_ttl: 600,
      enabled: false, description: rule.description
    });
  });

  it("enables rules with a partial update", async () => {
    const wrapper = await render();
    await wrapper.get('input[type="checkbox"]').setValue(true);
    await flushPromises();
    expect(updatePolicy).toHaveBeenCalledWith(42, { enabled: true });
  });

  it("edits answers and changes actions through the shared recent-domains menu", async () => {
    const wrapper = await render();
    const menu = wrapper.findComponent(PolicyMenu);
    menu.vm.$emit("saveSpoof", "192.0.2.53");
    await flushPromises();
    expect(updatePolicy).toHaveBeenLastCalledWith(42, { override_response: "192.0.2.53" });
    menu.vm.$emit("select", "allow");
    await flushPromises();
    expect(updatePolicy).toHaveBeenLastCalledWith(42, { action: "forward", override_response: null });
  });

  it("confirms inheritance as deletion and returns to the previous page after the last row", async () => {
    const wrapper = await render();
    wrapper.findComponent({ name: "v-data-table-server" }).vm.$emit("update:page", 2);
    await flushPromises();
    wrapper.findComponent(PolicyMenu).vm.$emit("select", "inherit");
    await flushPromises();
    expect(deletePolicy).not.toHaveBeenCalled();
    vi.mocked(listPolicies).mockResolvedValue({ items: [], total: 25 });
    await click(wrapper, "Delete");
    expect(deletePolicy).toHaveBeenCalledWith(42);
    expect(listPolicies).toHaveBeenLastCalledWith(25, 0, "override");
  });

  it("shows API validation errors in the editor and preserves form values", async () => {
    vi.mocked(updatePolicy).mockRejectedValue(new Error("Invalid IP answer"));
    const wrapper = await render();
    await wrapper.get('[aria-label="Edit spoof rule"]').trigger("click");
    await click(wrapper, "Save");
    expect(wrapper.text()).toContain("Invalid IP answer");
    expect(wrapper.get<HTMLInputElement>('[aria-label="Client (IP or *)"]').element.value).toBe("*");
  });

  it("keeps delete failures in the confirmation dialog", async () => {
    vi.mocked(deletePolicy).mockRejectedValue(new Error("Rule no longer exists"));
    const wrapper = await render();
    await wrapper.get('[aria-label="Delete spoof rule"]').trigger("click");
    await click(wrapper, "Delete");
    expect(wrapper.text()).toContain("Rule no longer exists");
    expect(wrapper.text()).toContain("Delete spoof rule");
  });

  it("keeps traffic and rules errors independent", async () => {
    vi.mocked(getSiteStats).mockRejectedValue(new Error("Traffic unavailable"));
    const wrapper = await render();
    expect(wrapper.text()).toContain(rule.domain);
    expect(wrapper.findComponent(TrafficChart).props("error")).toBe("Traffic unavailable");
  });
});

describe("spoofed traffic chart", () => {
  it("plots overridden rather than blocked counts, oldest first, capped at 100 wall-clock hours", () => {
    const stats: SiteHourlyStat[] = Array.from({ length: 101 }, (_, index) => ({
      hour_start: `2026-10-${String(1 + Math.floor(index / 24)).padStart(2, "0")}T${String(index % 24).padStart(2, "0")}:00:00`,
      overridden: index, blocked: 999, forwarded: 0, cached: 0,
      denied: 0, servfail: 0, local: 0, foreign: 0, total: index, clients: 1
    })).reverse();
    const wrapper = mount(TrafficChart, {
      props: { stats, loading: false, error: null, result: "overridden", title: "Spoofed Traffic" },
      global: {
        components: {
          apexchart: { name: "apexchart", props: ["series", "options"], template: "<div />" }
        },
        stubs: {
          "v-card": slotStub, "v-card-title": slotStub, "v-card-text": slotStub,
          "v-divider": true, "v-spacer": true, "v-icon": true, "v-progress-circular": true
        }
      }
    });
    const chart = wrapper.findComponent({ name: "apexchart" });
    expect(chart.props("series")).toEqual([{
      name: "Spoofed", type: "line", data: Array.from({ length: 100 }, (_, index) => index + 1)
    }]);
    expect(chart.props("options").xaxis.categories[0]).toBe("10/01 01:00");
  });
});