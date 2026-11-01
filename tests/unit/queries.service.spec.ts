import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/services/api";
import { listTopPolicyDenied } from "@/services/queries";

vi.mock("@/services/api", () => ({ default: { get: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

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
