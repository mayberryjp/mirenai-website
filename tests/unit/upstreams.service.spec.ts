import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() }
}));

import api from "@/services/api";
import { createUpstream, getUpstream, listUpstreams, updateUpstream } from "@/services/upstreams";
import type { Upstream, UpstreamCreate } from "@/types/domain";

const mocked = vi.mocked(api, true);
const upstream: Upstream = {
  id: 1, name: null, address: "1.1.1.1", port: 853, protocol: "udp",
  use_tls: true, tls_server_name: "cloudflare-dns.com", enabled: true, priority: 100,
  created_at: "", updated_at: ""
};

beforeEach(() => vi.clearAllMocks());

describe("upstream TLS API fields", () => {
  it("unwraps TLS configuration from list and detail responses", async () => {
    mocked.get.mockResolvedValueOnce({
      data: { status: "ok", upstreams: [upstream], total: 1 }
    }).mockResolvedValueOnce({ data: { status: "ok", upstream } });
    expect(await listUpstreams()).toEqual({ items: [upstream], total: 1 });
    expect(await getUpstream(1)).toEqual(upstream);
  });

  it("passes TLS settings to POST without requiring an explicit default port", async () => {
    const body: UpstreamCreate = {
      address: "1.1.1.1", use_tls: true, tls_server_name: "cloudflare-dns.com"
    };
    mocked.post.mockResolvedValue({ data: { status: "ok", upstream } });
    expect(await createUpstream(body)).toEqual(upstream);
    expect(mocked.post).toHaveBeenCalledWith("/upstreams", body);
  });

  it("passes the explicit TLS port and server name to PUT", async () => {
    const body = { use_tls: true, tls_server_name: "cloudflare-dns.com", port: 853 };
    mocked.put.mockResolvedValue({ data: { status: "ok", upstream } });
    expect(await updateUpstream(1, body)).toEqual(upstream);
    expect(mocked.put).toHaveBeenCalledWith("/upstreams/1", body);
  });

  it("keeps TLS optional for existing plain DNS callers", async () => {
    mocked.post.mockResolvedValue({
      data: { status: "ok", upstream: { ...upstream, port: 53, use_tls: false, tls_server_name: null } }
    });
    const created = await createUpstream({ address: "1.1.1.1" });
    expect(mocked.post).toHaveBeenCalledWith("/upstreams", { address: "1.1.1.1" });
    expect(created.use_tls).toBe(false);
  });
});
