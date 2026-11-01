import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/services/api";
import { findHostByIp, setHostNewDomainMonitoring } from "@/services/hosts";

vi.mock("@/services/api", () => ({
  default: { get: vi.fn(), put: vi.fn() }
}));

beforeEach(() => vi.clearAllMocks());

describe("host new-domain monitoring", () => {
  it("resolves hosts by IP but updates by ID with only the new monitoring field", async () => {
    const host = { id: 42, ip: "192.168.1.10", new_domain_monitoring: true, flag_new_domains: true };
    vi.mocked(api.get).mockResolvedValue({ data: { status: "ok", hosts: [host] } });
    expect(await findHostByIp(host.ip)).toEqual(host);
    const updated = { ...host, new_domain_monitoring: false, flag_new_domains: false };
    vi.mocked(api.put).mockResolvedValue({ data: { status: "ok", host: updated } });
    expect(await setHostNewDomainMonitoring(host.id, false)).toEqual(updated);
    expect(api.put).toHaveBeenCalledWith("/hosts/42", { new_domain_monitoring: false });
  });
});
