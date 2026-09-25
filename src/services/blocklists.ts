import api from "@/services/api";
import type { DeleteResult } from "@/types/api";
import type {
  Blocklist,
  BlocklistCreate,
  BlocklistList,
  BlocklistResponse,
  BlocklistUpdate,
  DomainList,
  Page
} from "@/types/domain";

export async function listBlocklists(limit?: number, offset?: number): Promise<Page<Blocklist>> {
  const res = await api.get<BlocklistList>("/blocklists", { params: { limit, offset } });
  return { items: res.data.blocklists, total: res.data.total };
}

export async function getBlocklist(id: number): Promise<Blocklist> {
  const res = await api.get<BlocklistResponse>(`/blocklists/${id}`);
  return res.data.blocklist;
}

export async function createBlocklist(body: BlocklistCreate): Promise<Blocklist> {
  const res = await api.post<BlocklistResponse>("/blocklists", body);
  return res.data.blocklist;
}

export async function updateBlocklist(id: number, body: BlocklistUpdate): Promise<Blocklist> {
  const res = await api.put<BlocklistResponse>(`/blocklists/${id}`, body);
  return res.data.blocklist;
}

export async function deleteBlocklist(id: number): Promise<number> {
  const res = await api.delete<DeleteResult>(`/blocklists/${id}`);
  return res.data.deleted;
}

// Domain lists can be very large — always paginate (spec §7.4).
export async function listBlocklistDomains(
  id: number,
  limit?: number,
  offset?: number
): Promise<Page<string>> {
  const res = await api.get<DomainList>(`/blocklists/${id}/domains`, { params: { limit, offset } });
  return { items: res.data.domains, total: res.data.total };
}

// Synchronous download + reparse; may take seconds. 502 download_failed carries detail.
export async function refreshBlocklist(id: number): Promise<Blocklist> {
  const res = await api.post<BlocklistResponse>(`/blocklists/${id}/refresh`);
  return res.data.blocklist;
}
