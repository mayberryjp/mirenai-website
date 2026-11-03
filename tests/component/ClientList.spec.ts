import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { ref } from "vue";
import ClientList from "@/components/dashboard/ClientList.vue";
import { useClientsStore } from "@/stores/clients";
import { listHosts } from "@/services/hosts";
import { getNewDomainStats } from "@/services/stats";
import type { Host } from "@/types/domain";

vi.mock("vue-router", () => ({
  useRoute: () => ({ name: "dashboard", params: {} }),
  useRouter: () => ({ push: vi.fn() })
}));
vi.mock("vuetify", () => ({ useDisplay: () => ({ lgAndUp: ref(true) }) }));
vi.mock("@/stores/policies", () => ({
  usePoliciesStore: () => ({ items: [{}], policyFor: () => undefined })
}));
vi.mock("@/services/hosts", () => ({ listHosts: vi.fn() }));
vi.mock("@/services/stats", () => ({ getNewDomainStats: vi.fn() }));

function host(id: number, monitored: boolean, queries: number): Host {
  return {
    id, ip: `192.168.1.${id}`, device_name: `Device ${id}`, icon: "TV",
    mac_address: null, excluded_from_blocklist: false,
    flag_new_domains: monitored, new_domain_monitoring: monitored,
    query_count: queries, "500h_queries": queries,
    first_seen: "2026-11-01T10:00:00", last_seen: "2026-11-01T10:00:00"
  };
}

const slotStub = { template: "<div><slot /></div>" };

async function render(hosts: Host[], counts: number[]) {
  vi.mocked(listHosts).mockResolvedValue(hosts);
  vi.mocked(getNewDomainStats).mockResolvedValue(hosts.map((h, i) => ({
    client: h.ip, hour_start: "2026-11-01T10:00:00", new_domains: counts[i]
  })));
  const pinia = createPinia();
  const wrapper = mount(ClientList, {
    global: {
      plugins: [pinia],
      stubs: {
        DeviceIcon: { props: ["color"], template: '<span class="test-icon" :data-color="color" />' },
        AlertBars: true,
        AsyncState: slotStub,
        "v-sheet": slotStub,
        "v-icon": true,
        "v-expand-transition": slotStub,
        "v-text-field": true,
        "v-btn-toggle": {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template: '<div><button class="query-sort" @click="$emit(\'update:modelValue\', \'queries\')">Queries</button><slot /></div>'
        },
        "v-btn": slotStub,
        "v-list": slotStub,
        "v-list-item": slotStub
      }
    }
  });
  await flushPromises();
  return { wrapper, store: useClientsStore(pinia) };
}

beforeEach(() => vi.resetAllMocks());

describe("client sidebar monitoring", () => {
  it("places unmonitored clients last despite high counts and mutes only their icons", async () => {
    const { wrapper } = await render(
      [host(1, false, 29590), host(2, true, 23), host(3, true, 100), host(4, false, 500)],
      [463, 14, 0, 151]
    );
    const rows = wrapper.findAll(".host-list-item");
    expect(rows.map((row) => row.get(".host-info").text())).toEqual([
      "Device 2", "Device 3", "Device 1", "Device 4"
    ]);
    expect(rows.map((row) => row.get(".test-icon").attributes("data-color"))).toEqual([
      "#FF9800", "#2EC4A0", "#6e7681", "#6e7681"
    ]);
    expect(rows[2].get(".new-domain-count").text()).toBe("463");
    expect(rows[2].get(".threat-score-text").text()).toContain((29590).toLocaleString());
    await wrapper.get(".query-sort").trigger("click");
    expect(wrapper.findAll(".host-info").map((row) => row.text())).toEqual([
      "Device 1", "Device 4", "Device 3", "Device 2"
    ]);
  });

  it("preserves monitored severity thresholds and existing metric tie-breaks", async () => {
    const { wrapper } = await render(
      [host(1, true, 10), host(2, true, 20), host(3, true, 30),
        host(4, true, 40), host(5, true, 50), host(6, true, 60)],
      [0, 9, 24, 49, 50, 50]
    );
    const rows = wrapper.findAll(".host-list-item");
    expect(rows.map((row) => row.get(".host-info").text())).toEqual([
      "Device 6", "Device 5", "Device 4", "Device 3", "Device 2", "Device 1"
    ]);
    expect(rows.map((row) => row.get(".test-icon").attributes("data-color"))).toEqual([
      "#B71C1C", "#B71C1C", "#F44336", "#FF9800", "#FFD600", "#2EC4A0"
    ]);
  });

  it("supports legacy flags and reacts to monitoring changes without changing counts", async () => {
    const legacy = host(1, false, 100);
    Reflect.deleteProperty(legacy, "new_domain_monitoring");
    const { wrapper, store } = await render([legacy, host(2, true, 10)], [463, 6]);
    expect(wrapper.findAll(".host-info").map((row) => row.text())).toEqual(["Device 2", "Device 1"]);
    store.hostNewDomainMonitoring[legacy.ip] = true;
    await flushPromises();
    expect(wrapper.findAll(".host-info").map((row) => row.text())).toEqual(["Device 1", "Device 2"]);
    expect(wrapper.get(".test-icon").attributes("data-color")).toBe("#B71C1C");
    expect(wrapper.get(".new-domain-count").text()).toBe("463");
    vi.mocked(listHosts).mockResolvedValue([host(2, true, 10)]);
    await store.load();
    expect(store.hostNewDomainMonitoring).toEqual({ "192.168.1.2": true });
  });
});
