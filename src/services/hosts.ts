import api from "@/services/api";
import type { Host, HostList, HostResponse } from "@/types/domain";

export async function listHosts(): Promise<Host[]> {
  const res = await api.get<HostList>("/hosts");
  return res.data.hosts;
}

// Hosts are keyed by numeric id, not IP — resolve the row for a client IP first.
export async function findHostByIp(ip: string): Promise<Host | null> {
  const hosts = await listHosts();
  return hosts.find((h) => h.ip === ip) ?? null;
}

// device_name: trimmed string, or null/"" to clear the name.
export async function updateHostName(id: number, deviceName: string | null): Promise<Host> {
  const res = await api.put<HostResponse>(`/hosts/${id}`, { device_name: deviceName });
  return res.data.host;
}
