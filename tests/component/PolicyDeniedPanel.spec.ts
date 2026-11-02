import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import PolicyDeniedPanel from "@/components/settings/PolicyDeniedPanel.vue";
import PolicyControl from "@/components/base/PolicyControl.vue";
import TrafficChart from "@/components/dashboard/BlocklistTrafficChart.vue";
import { listTopPolicyDenied } from "@/services/queries";
import { getSiteStats } from "@/services/stats";
import type { SiteHourlyStat, TopPolicyDeniedDomain } from "@/types/domain";

const stores = vi.hoisted(() => ({
  clients: { loaded: true, error: null, load: vi.fn(), nameFor: (ip: string) => `Device ${ip}` },
  policies: { loading: false, error: null as string | null, load: vi.fn() }
}));
vi.mock("@/stores/clients", () => ({ useClientsStore: () => stores.clients }));
vi.mock("@/stores/policies", () => ({ usePoliciesStore: () => stores.policies }));
vi.mock("@/services/queries", () => ({ listTopPolicyDenied: vi.fn() }));
vi.mock("@/services/stats", () => ({ getSiteStats: vi.fn() }));

const row: TopPolicyDeniedDomain = {
  domain: "example.com", count: 2345,
  clients: [{ client: "192.168.1.10", count: 2000 }, { client: "192.168.1.11", count: 345 }],
  first_seen: "2026-11-01T02:15:00", last_seen: "2026-11-01T10:30:00"
};
const slotStub = { template: "<div><slot /></div>" };
const tableStub = {
  props: ["items", "headers", "page", "itemValue", "itemsPerPage"],
  emits: ["update:page", "update:itemsPerPage"],
  template: `<div><div v-for="item in items" :key="JSON.stringify(item)">
    {{ item.domain }}
    <slot name="item.clients" :item="item" />
    <slot name="item.count" :item="item" />
    <slot name="item.first_seen" :item="item" />
    <slot name="item.last_seen" :item="item" />
    <slot name="item.action" :item="item" />
    <slot name="item.policy" :item="item" />
    <slot name="item.hour_start" :item="item" />
    <slot name="item.denied" :item="item" />
  </div></div>`
};
async function render() {
  const wrapper = mount(PolicyDeniedPanel, {
    global: {
      stubs: {
        BlocklistTrafficChart: true,
        PolicyControl: true, RouterLink: slotStub,
        "v-sheet": slotStub, "v-card-title": slotStub, "v-alert": slotStub,
        "v-chip": slotStub, "v-spacer": true,
        "v-btn": { template: "<button><slot /></button>" },
        "v-data-table": { ...tableStub, name: "v-data-table" },
        "v-data-table-server": { ...tableStub, name: "v-data-table-server" }
      }
    }
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.resetAllMocks();
  stores.policies.error = null;
  stores.policies.loading = false;
  vi.mocked(listTopPolicyDenied).mockResolvedValue({ items: [row], total: 1 });
  vi.mocked(getSiteStats).mockResolvedValue([]);
});

describe("policy denied settings", () => {
  it("loads ranked domains, shows only the total count and denial dates, and targets every exact pair", async () => {
    const wrapper = await render();
    expect(listTopPolicyDenied).toHaveBeenCalledWith(100);
    expect(getSiteStats).toHaveBeenCalledWith(100);
    expect(stores.policies.load).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("Device 192.168.1.10");
    expect(wrapper.text()).toContain("Device 192.168.1.11");
    expect(wrapper.text()).not.toContain("(2,000)");
    expect(wrapper.text()).not.toContain("(345)");
    expect(wrapper.text()).toContain("2,345");
    expect(wrapper.text()).toContain("11/01 02:15");
    expect(wrapper.text()).toContain("11/01 10:30");
    expect(wrapper.text()).toContain("Policy Denied");
    expect(wrapper.findComponent(PolicyControl).props()).toMatchObject({
      client: row.clients[0].client, domain: row.domain
    });
    expect(wrapper.findAllComponents(PolicyControl).map((control) => control.props())).toEqual(
      row.clients.map((client) => ({ client: client.client, domain: row.domain }))
    );
  });

  it("pages the fetched domains locally without sending an unsupported offset", async () => {
    const wrapper = await render();
    const table = wrapper.findComponent({ name: "v-data-table" });
    table.vm.$emit("update:page", 2);
    await flushPromises();
    expect(listTopPolicyDenied).toHaveBeenCalledOnce();
    expect(table.props("page")).toBe(2);
    table.vm.$emit("update:itemsPerPage", 10);
    await flushPromises();
    expect(table.props("page")).toBe(1);
    expect(table.props("itemsPerPage")).toBe(10);
    expect(listTopPolicyDenied).toHaveBeenCalledOnce();
  });

  it("uses the shared Blocklist Activity chart with the denied series", async () => {
    const stats: SiteHourlyStat[] = Array.from({ length: 101 }, (_, index) => ({
      hour_start: `2026-10-${String(1 + Math.floor(index / 24)).padStart(2, "0")}T${String(index % 24).padStart(2, "0")}:00:00`,
      denied: index + 1, blocked: 999, total: 2000, clients: 1,
      forwarded: 0, cached: 0, overridden: 0, servfail: 0, local: 0, foreign: 0
    }));
    vi.mocked(getSiteStats).mockResolvedValue(stats);
    const wrapper = await render();
    const chart = wrapper.findComponent(TrafficChart);
    expect(chart.props("stats")).toEqual(stats);
    expect(chart.props("result")).toBe("denied");
    expect(chart.props("title")).toBe("Policy Denied Traffic");
    expect(wrapper.findComponent({ name: "v-data-table-server" }).exists()).toBe(false);
  });

  it("keeps hourly and ranked errors independent and retries both on refresh", async () => {
    vi.mocked(listTopPolicyDenied).mockRejectedValueOnce(new Error("Denied endpoint unavailable"));
    const wrapper = await render();
    expect(wrapper.text()).toContain("Denied endpoint unavailable");
    expect(wrapper.findComponent(TrafficChart).props("error")).toBeNull();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain(row.domain);
    expect(getSiteStats).toHaveBeenCalledTimes(2);
    vi.mocked(getSiteStats).mockRejectedValueOnce(new Error("Hourly unavailable"));
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.findComponent(TrafficChart).props("error")).toBe("Hourly unavailable");
    expect(wrapper.text()).toContain(row.domain);
  });

  describe("policy denied traffic chart", () => {
    it("plots only denied counts, oldest first, capped at 100 raw wall-clock hours", () => {
      const stats: SiteHourlyStat[] = Array.from({ length: 101 }, (_, index) => ({
        hour_start: `2026-10-${String(1 + Math.floor(index / 24)).padStart(2, "0")}T${String(index % 24).padStart(2, "0")}:00:00`,
        denied: index, blocked: 999, overridden: 888, total: 2000, clients: 1,
        forwarded: 0, cached: 0, servfail: 0, local: 0, foreign: 0
      })).reverse();
      const wrapper = mount(TrafficChart, {
        props: { stats, loading: false, error: null, result: "denied", title: "Policy Denied Traffic" },
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
        name: "Policy Denied", type: "line", data: Array.from({ length: 100 }, (_, index) => index + 1)
      }]);
      const options = chart.props("options");
      expect(options.chart.id).toBe("policy-denied-traffic-chart");
      expect(options.colors).toEqual(["#f5822a"]);
      expect(options.xaxis.categories[0]).toBe("10/01 01:00");
      expect(options.yaxis.title.text).toBe("Policy denials / hour");
    });

    it("preserves the default blocklist series and empty-state label", () => {
      const wrapper = mount(TrafficChart, {
        props: { stats: [], loading: false, error: null },
        global: { stubs: {
          "v-card": slotStub, "v-card-title": slotStub, "v-card-text": slotStub,
          "v-divider": true, "v-spacer": true, "v-icon": true,
          "v-progress-circular": true, apexchart: true
        } }
      });
      expect(wrapper.text()).toContain("Blocklist Denied Traffic");
      expect(wrapper.text()).toContain("No blocklist activity in the last 100 hours.");
    });
  });

  it("does not expose policy editing with unloaded or failed policies", async () => {
    stores.policies.error = "Policies unavailable";
    const wrapper = await render();
    expect(wrapper.text()).toContain("Response policies could not be loaded");
    expect(wrapper.findComponent(PolicyControl).exists()).toBe(false);
    expect(wrapper.text()).toContain(row.domain);
  });

  it("uses a single domain row for all clients and retains backend ranking", async () => {
    const wrapper = await render();
    const table = wrapper.findComponent({ name: "v-data-table" });
    expect(table.props("itemValue")).toBe("domain");
    expect(table.props("items")).toEqual([row]);
    expect(table.props("headers").every((header: { sortable: boolean }) => !header.sortable)).toBe(true);
  });
});
