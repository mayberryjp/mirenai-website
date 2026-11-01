import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createVuetify } from "vuetify";
import { VDataTable } from "vuetify/components/VDataTable";
import DomainPolicyTable from "@/components/client-details/DomainPolicyTable.vue";
import PolicyMenu from "@/components/base/PolicyMenu.vue";
import ActionFilter from "@/components/base/ActionFilter.vue";
import { createPolicy, deletePolicy, listPolicies, updatePolicy } from "@/services/policies";
import type { Policy, PolicyCreate, QueryLog } from "@/types/domain";

vi.mock("@/services/policies", () => ({
  createPolicy: vi.fn(),
  listPolicies: vi.fn(),
  updatePolicy: vi.fn(),
  deletePolicy: vi.fn()
}));

const client = "192.0.2.10";
const slotStub = { template: "<div><slot /></div>" };

function row(id: number, domain = `domain-${id}.example`, qtype = "A"): QueryLog {
  return {
    id, client, domain, qtype, count: id, last_action: "deny",
    first_seen: "2020-01-01T00:00:00", last_seen: "2020-01-01T00:00:00"
  };
}

function policy(id: number, body: PolicyCreate): Policy {
  return {
    id, override_response: null, override_ttl: 300, enabled: true,
    description: null, created_at: "", updated_at: "", ...body
  };
}

async function render(rows: QueryLog[]) {
  const wrapper = mount(DomainPolicyTable, {
    props: { client, rows, clientMode: "deny" },
    global: {
      plugins: [createVuetify()],
      components: { VDataTable },
      stubs: {
        PolicyMenu: true,
        ActionFilter: true,
        "v-sheet": slotStub,
        "v-card-title": slotStub,
        "v-spacer": true,
        "v-divider": true,
        "v-alert": slotStub,
        "v-chip": slotStub,
        "v-btn": {
          props: ["disabled", "loading"],
          template: "<button :disabled='disabled'><slot /></button>"
        },
        "v-text-field": {
          inheritAttrs: false,
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template: `<input :value="modelValue"
            @input="$emit('update:modelValue', $event.target.value)" />`
        }
      }
    }
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  vi.mocked(listPolicies).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(createPolicy).mockImplementation(async (body) => policy(100 + Number(body.domain.match(/\d+/)?.[0] ?? 0), body));
  vi.mocked(updatePolicy).mockImplementation(async (id, body) =>
    policy(id, { client, domain: "existing.example", action: "forward", ...body }));
});

describe("DomainPolicyTable Allow All", () => {
  it("places Allow All after the domain filter with matching input height", async () => {
    const wrapper = await render([row(1)]);
    const button = wrapper.get("button");
    expect(button.attributes("height")).toBe("40");
    expect(button.element.previousElementSibling).toBe(wrapper.get("input").element);
  });

  it("allows only the current page and respects table sorting", async () => {
    const wrapper = await render(Array.from({ length: 30 }, (_, i) => row(i + 1)));
    await wrapper.get("th:nth-child(3)").trigger("click");
    await flushPromises();
    await wrapper.get('button[aria-label="Next page"]').trigger("click");
    await flushPromises();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(vi.mocked(createPolicy).mock.calls.map(([body]) => body.domain)).toEqual(
      [26, 27, 28, 29, 30].map((id) => `domain-${id}.example`)
    );
    expect(wrapper.findAllComponents(PolicyMenu).every((menu) => menu.props("choice") === "allow")).toBe(true);
  });

  it("uses the filtered snapshot, deduplicates domains and clears spoof responses", async () => {
    const existing = policy(42, { client, domain: "target.example", action: "override", override_response: "192.0.2.53" });
    vi.mocked(listPolicies).mockResolvedValue({ items: [existing], total: 1 });
    const wrapper = await render([
      row(1, "target.example"), row(2, "target.example", "AAAA"),
      row(3, "target-new.example"), row(4, "hidden.example")
    ]);
    await wrapper.get("input").setValue("target");
    wrapper.findComponent(ActionFilter).vm.$emit("update:modelValue", ["override", "deny"]);
    await flushPromises();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(updatePolicy).toHaveBeenCalledTimes(1);
    expect(updatePolicy).toHaveBeenCalledWith(42, {
      client, domain: "target.example", action: "forward", override_response: null
    });
    expect(createPolicy).toHaveBeenCalledTimes(1);
    expect(createPolicy).toHaveBeenCalledWith({
      client, domain: "target-new.example", action: "forward", override_response: null
    });
  });

  it("disables empty tables and tables whose policy load failed", async () => {
    const empty = await render([]);
    expect(empty.get<HTMLButtonElement>("button").element.disabled).toBe(true);
    vi.mocked(listPolicies).mockRejectedValueOnce(new Error("Policies unavailable"));
    const failed = await render([row(1)]);
    expect(failed.text()).toContain("Policies unavailable");
    expect(failed.get<HTMLButtonElement>("button").element.disabled).toBe(true);
  });

  it("blocks duplicate clicks and row changes while saving", async () => {
    let resolveSave!: (saved: Policy) => void;
    vi.mocked(createPolicy).mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const wrapper = await render([row(1)]);
    await wrapper.get("button").trigger("click");
    expect(wrapper.get<HTMLButtonElement>("button").element.disabled).toBe(true);
    const menu = wrapper.findComponent(PolicyMenu);
    expect(menu.props("saving")).toBe(true);
    menu.vm.$emit("select", "block");
    await wrapper.get("button").trigger("click");
    expect(createPolicy).toHaveBeenCalledTimes(1);
    resolveSave(policy(1, { client, domain: "domain-1.example", action: "forward" }));
    await flushPromises();
    expect(menu.props("choice")).toBe("allow");
    expect(wrapper.get<HTMLButtonElement>("button").element.disabled).toBe(false);
  });

  it("shows failed domains while continuing to save other visible domains", async () => {
    vi.mocked(createPolicy).mockRejectedValueOnce(new Error("Request failed"));
    const wrapper = await render([row(1), row(2)]);
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(createPolicy).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("domain-2.example: Request failed");
    const menus = wrapper.findAllComponents(PolicyMenu);
    expect(menus.map((menu) => menu.props("choice"))).toEqual(["inherit", "allow"]);
  });

  it("stops the batch when navigating to another client without applying stale results", async () => {
    let resolveSave!: (saved: Policy) => void;
    vi.mocked(createPolicy).mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const wrapper = await render([row(1), row(2)]);
    await wrapper.get("button").trigger("click");
    const nextClient = "192.0.2.20";
    vi.mocked(listPolicies).mockResolvedValueOnce({
      items: [policy(50, { client: nextClient, domain: "domain-2.example", action: "deny" })],
      total: 1
    });
    await wrapper.setProps({ client: nextClient, rows: [{ ...row(2), client: nextClient }] });
    await flushPromises();
    resolveSave(policy(2, { client, domain: "domain-2.example", action: "forward" }));
    await flushPromises();
    expect(createPolicy).toHaveBeenCalledTimes(1);
    expect(wrapper.findComponent(PolicyMenu).props("choice")).toBe("block");
  });

  it("preserves individual override creation, spoof updates and inheritance deletion", async () => {
    const wrapper = await render([row(1)]);
    const menu = wrapper.findComponent(PolicyMenu);
    menu.vm.$emit("select", "allow");
    await flushPromises();
    expect(menu.props("choice")).toBe("allow");
    menu.vm.$emit("saveSpoof", " 192.0.2.53 ");
    await flushPromises();
    expect(updatePolicy).toHaveBeenCalledWith(101, {
      client, domain: "domain-1.example", action: "override", override_response: "192.0.2.53"
    });
    expect(menu.props("choice")).toBe("spoof");
    menu.vm.$emit("select", "inherit");
    await flushPromises();
    expect(deletePolicy).toHaveBeenCalledWith(101);
    expect(menu.props("choice")).toBe("inherit");
  });
});
