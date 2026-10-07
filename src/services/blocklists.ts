import api from "@/services/api";
import type { DeleteResult } from "@/types/api";
import type {
  Blocklist,
  BlocklistCreate,
  BlocklistList,
  BlocklistMatch,
  BlocklistOverride,
  BlocklistOverrideCreate,
  BlocklistOverrideList,
  BlocklistOverrideResponse,
  BlocklistResponse,
  BlocklistSearchResponse,
  BlocklistSizeStat,
  BlocklistSizeStatsResponse,
  BlocklistUpdate,
  DomainList,
  Page,
  RecentBlocklistEntriesResponse,
  RecentBlocklistEntry
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

// Synchronous download + reparse; large lists can take a few minutes, so override
// the shared 30s client timeout. 502 download_failed carries detail.
const REFRESH_TIMEOUT_MS = 240000; // 4 min — on-demand downloads can take up to ~3 min
export async function refreshBlocklist(id: number): Promise<Blocklist> {
  const res = await api.post<BlocklistResponse>(`/blocklists/${id}/refresh`, undefined, {
    timeout: REFRESH_TIMEOUT_MS
  });
  return res.data.blocklist;
}

// Search every blocklist (enabled or not) for stored domains containing `q`
// (case-insensitive substring); returns each match with the blocklist it's on.
export async function searchBlocklistDomains(
  q: string,
  limit = 100
): Promise<Page<BlocklistMatch>> {
  const res = await api.get<BlocklistSearchResponse>("/blocklists/search", {
    params: { q, limit }
  });
  return { items: res.data.matches, total: res.data.total };
}

// ---- Overrides (allowlist) ----
// Exempted domains are stripped from blocklists at download time; a refresh is
// required before changes take effect.
export async function listBlocklistOverrides(
  limit?: number,
  offset?: number
): Promise<Page<BlocklistOverride>> {
  const res = await api.get<BlocklistOverrideList>("/blocklists/overrides", {
    params: { limit, offset }
  });
  return { items: res.data.overrides, total: res.data.total };
}

export async function createBlocklistOverride(
  body: BlocklistOverrideCreate
): Promise<BlocklistOverride> {
  const res = await api.post<BlocklistOverrideResponse>("/blocklists/overrides", body);
  return res.data.override;
}

export async function deleteBlocklistOverride(id: number): Promise<number> {
  const res = await api.delete<DeleteResult>(`/blocklists/overrides/${id}`);
  return res.data.deleted;
}

// Hourly total count of domains across all blocklists for the blocklists-page size chart.
// GET /blocklists/size-history?hours=<n> — newest hour first; the chart re-sorts oldest → newest.
export async function getBlocklistSizeStats(hours = 100): Promise<BlocklistSizeStat[]> {
  const res = await api.get<BlocklistSizeStatsResponse>("/blocklists/size-history", {
    params: { hours }
  });
  return res.data.size_history;
}

// Most recently first-seen blocklist domains for the "new blocklist entries" table.
// GET /blocklists/recent?limit=<n> — ordered newest-first-seen first.
export async function getRecentBlocklistEntries(limit = 100): Promise<RecentBlocklistEntry[]> {
  const res = await api.get<RecentBlocklistEntriesResponse>("/blocklists/recent", {
    params: { limit }
  });
  return res.data.domains;
}
