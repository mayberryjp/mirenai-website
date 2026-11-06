import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import RecentDomainsTable from "@/components/dashboard/RecentDomainsTable.vue";
import type { RecentNewDomain } from "@/types/domain";

vi.mock("@/stores/clients", () => ({
  useClientsStore: () => ({ nameFor: () => "Living Room Media Server" })
}));
vi.mock("@/stores/policies", () => ({
  usePoliciesStore: () => ({ load: vi.fn() })
}));

const slotStub = { template: "<div><slot /></div>" };

function render(domains: string[], title?: string, firstSeen: string[] = []) {
  const rows: RecentNewDomain[] = domains.map((domain, index) => ({
    client: "192.168.1.10",
    domain,
    first_seen: firstSeen[index] ?? "2026-11-01T10:17:58",
    last_action: "forward",
    last_qtype: "A"
  }));
  return mount(RecentDomainsTable, {
    props: { rows, loading: false, error: null, ...(title ? { title } : {}) },
    global: {
      stubs: {
        ActionFilter: true,
        PolicyControl: true,
        "v-sheet": slotStub,
        "v-card-title": slotStub,
        "v-spacer": true,
        "v-text-field": true,
        "v-divider": true,
        "v-alert": slotStub,
        "v-chip": slotStub,
        "v-tooltip": {
          name: "v-tooltip",
          props: ["text"],
          template: `<div><slot name="activator" :props="{ title: text }" /></div>`
        },
        "v-data-table": {
          props: ["items"],
          template: `<div><div v-for="item in items" :key="item.domain" class="row">
            <div class="client"><slot name="item.client" :item="item" /></div>
            <div class="domain"><slot name="item.domain" :item="item" /></div>
            <slot name="item.policy" :item="item" />
            <slot name="item.first_seen" :item="item" />
          </div></div>`
        }
      }
    }
  });
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(new Date("2026-11-07T12:00:00").getTime());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("newly seen domains table", () => {
  it("matches the host NEW chip only for domains first seen less than 24 hours ago", () => {
    const wrapper = render(
      ["recent.example", "boundary.example", "older.example", "invalid.example", `${"b".repeat(26)}.com`],
      undefined,
      [
        "2026-11-06T12:00:00.001",
        "2026-11-06T12:00:00",
        "2026-11-06T11:59:59.999",
        "invalid",
        "2026-11-07T11:00:00"
      ]
    );
    const cells = wrapper.findAll(".domain");
    expect(cells.map((cell) => cell.find(".new-chip").exists())).toEqual([
      true, false, false, false, true
    ]);
    const chip = cells[0].get(".new-chip");
    expect(chip.text()).toBe("NEW");
    expect(chip.attributes()).toMatchObject({
      size: "x-small", variant: "flat", color: "success"
    });
    expect(cells[4].get("span").text()).toBe(`${"b".repeat(25)}...`);
  });

  it("uses the new default title and preserves custom titles", () => {
    expect(render([]).text()).toContain("Newly Seen Domains");
    expect(render([], "Custom domains").text()).toContain("Custom domains");
  });

  it("keeps client names and first-seen timestamps on one line", () => {
    const wrapper = render(["example.com"]);
    expect(wrapper.get(".client span").text()).toBe("Living Room Media Server");
    expect(wrapper.get(".client span").classes()).toContain("text-no-wrap");
    expect(wrapper.get(".date-column").text()).toBe("11/01 10:17");
    expect(wrapper.get(".date-column").classes()).toContain("text-no-wrap");
  });

  it("truncates only domains longer than 25 characters and exposes the full name on hover", () => {
    const domains = ["example.com", `${"a".repeat(21)}.com`, `${"b".repeat(22)}.com`];
    const wrapper = render(domains);
    const cells = wrapper.findAll(".domain");
    expect(cells.map((cell) => cell.text())).toEqual([
      domains[0], domains[1], `${domains[2].slice(0, 25)}...`
    ]);
    expect(cells.every((cell) => cell.get("span").classes().includes("text-no-wrap"))).toBe(true);
    const tooltips = wrapper.findAllComponents({ name: "v-tooltip" });
    expect(tooltips).toHaveLength(1);
    expect(tooltips[0].props("text")).toBe(domains[2]);
    expect(cells[2].get("span").attributes("title")).toBe(domains[2]);
    expect(wrapper.findAllComponents({ name: "PolicyControl" })[2].props("domain")).toBe(domains[2]);
  });
});
