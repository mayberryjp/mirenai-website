import api from "@/services/api";
import type {
  CacheEntriesResponse,
  CacheEntry,
  CacheFlushResponse,
  CacheMissReason,
  Page,
  UncacheableList,
  UncacheableRow
} from "@/types/domain";

// GET /cache — current resolver cache entries (one row per cached DNS answer).
export async function listCacheEntries(): Promise<CacheEntry[]> {
  const res = await api.get<CacheEntriesResponse>("/cache");
  return res.data.entries;
}

// POST /cache/flush — records a flush request (no body). The DNS worker clears its
// cache on its next poll (within refresh_seconds), so this is not instantaneous.
export async function flushCache(): Promise<CacheFlushResponse> {
  const res = await api.post<CacheFlushResponse>("/cache/flush");
  return res.data;
}

// GET /cache/uncacheable — forwarded answers that couldn't be cached, aggregated
// per (domain, qtype, reason), highest-hits first. Omitting limit/offset returns all.
export async function listUncacheable(
  reason?: CacheMissReason,
  limit?: number,
  offset?: number
): Promise<Page<UncacheableRow>> {
  const res = await api.get<UncacheableList>("/cache/uncacheable", {
    params: { reason, limit, offset }
  });
  return { items: res.data.uncacheable, total: res.data.total };
}
