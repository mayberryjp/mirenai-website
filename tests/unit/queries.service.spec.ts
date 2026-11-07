import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/services/api";
import { listQueries, listTopPolicyDenied } from "@/services/queries";

vi.mock("@/services/api", () => ({ default: { get: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

describe("query log retained history", () => {
  it("preserves retained domain_first_seen alongside the existing query-log fields", async () => {
    const queries = ["A", "AAAA"].map((qtype, id) => ({
      id, client: "10.3.10.2", domain: "lscr.io", qtype, count: 19,
      last_action: "forward", first_seen: "2026-11-07T16:00:00",
      domain_first_seen: "2026-10-09T10:00:00", last_seen: "2026-11-07T16:54:45"
    }));
    vi.mocked(api.get).mockResolvedValue({ data: { status: "ok", queries, total: 2 } });
    await expect(listQueries(5000, 0, undefined, "10.3.10.2")).resolves.toEqual({
      items: queries, total: 2
    });
    expect(api.get).toHaveBeenCalledWith("/queries", {
      params: { limit: 5000, offset: 0, search: undefined, client: "10.3.10.2" }
    });
  });
});

describe("top policy denied service", () => {
  it("sends a limit and client filter without offset and unwraps nested domain counts", async () => {
    const domains = [{
      domain: "example.com", count: 20, clients: [{ client: "192.168.1.10", count: 20 }],
      first_seen: "2026-11-01T02:00:00", last_seen: "2026-11-01T10:00:00"
    }];
    vi.mocked(api.get).mockResolvedValue({ data: { status: "ok", domains, total: 1 } });
    await expect(listTopPolicyDenied(25, "192.168.1.10")).resolves.toEqual({ items: domains, total: 1 });
    expect(api.get).toHaveBeenCalledWith("/queries/top-denied", { params: { limit: 25, client: "192.168.1.10" } });
  });

  it("supports all-client and empty results without inventing a pre-limit total", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { status: "ok", domains: [], total: 0 } });
    await expect(listTopPolicyDenied(100)).resolves.toEqual({ items: [], total: 0 });
    expect(api.get).toHaveBeenCalledWith("/queries/top-denied", { params: { limit: 100, client: undefined } });
  });

  it("propagates backend failures instead of reporting empty traffic", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Not found"));
    await expect(listTopPolicyDenied(25)).rejects.toThrow("Not found");
  });
});
