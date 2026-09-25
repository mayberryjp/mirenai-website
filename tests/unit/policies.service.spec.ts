import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));

import api from "@/services/api";
import { createPolicy, deletePolicy, listPolicies } from "@/services/policies";

const mocked = vi.mocked(api, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("policies service", () => {
  it("listPolicies unwraps the collection envelope", async () => {
    mocked.get.mockResolvedValue({ data: { status: "ok", policies: [{ id: 1 }], total: 1 } });
    const page = await listPolicies();
    expect(mocked.get).toHaveBeenCalledWith("/policies", { params: { limit: undefined, offset: undefined } });
    expect(page.total).toBe(1);
    expect(page.items).toHaveLength(1);
  });

  it("createPolicy returns the created resource", async () => {
    mocked.post.mockResolvedValue({ data: { status: "ok", policy: { id: 7 } } });
    const created = await createPolicy({ client: "*", domain: "example.com", action: "deny" });
    expect(mocked.post).toHaveBeenCalledWith("/policies", { client: "*", domain: "example.com", action: "deny" });
    expect(created.id).toBe(7);
  });

  it("deletePolicy returns the deleted id", async () => {
    mocked.delete.mockResolvedValue({ data: { status: "ok", deleted: 7 } });
    expect(await deletePolicy(7)).toBe(7);
    expect(mocked.delete).toHaveBeenCalledWith("/policies/7");
  });
});
