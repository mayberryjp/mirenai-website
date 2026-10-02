import api from "@/services/api";
import type { Host, HostList, HostResponse, HostUpdate, Page } from "@/types/domain";

// Hosts are auto-recorded one row per source IP. Device name and per-client
// flags (e.g. flag_new_domains) are editable via PUT /hosts/{id}.
const HOST_SCAN_LIMIT = 5000;

export async function listHosts(limit?: number, offset?: number): Promise<Page<Host>> {
  const res = await api.get<HostList>("/hosts", { params: { limit, offset } });
  return { items: res.data.hosts, total: res.data.total };
}

export async function updateHost(id: number, body: HostUpdate): Promise<Host> {
  const res = await api.put<HostResponse>(`/hosts/${id}`, body);
  return res.data.host;
}

// The client detail route is keyed by IP, but /hosts is addressed by id, so
// resolve the host by scanning the (paginated) roster for a matching IP.
export async function findHostByIp(ip: string): Promise<Host | null> {
  const { items } = await listHosts(HOST_SCAN_LIMIT, 0);
  return items.find((h) => h.ip === ip) ?? null;
}
