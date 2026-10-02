import api from "@/services/api";
import type {
  ClientStat,
  ClientStatsResponse,
  NewDomainStat,
  NewDomainStatsResponse,
  RecentNewDomain,
  RecentNewDomainsResponse,
  RuntimeStats,
  RuntimeStatsResponse,
  SiteHourlyStat,
  SiteStatsResponse,
  UpstreamRttStat,
  UpstreamRttStatsResponse
} from "@/types/domain";

// Per-client hourly query stats for the client detail chart.
// GET /stats?client=<ip>&hours=<n> — newest-hour-first; the chart re-sorts oldest → newest.
export async function getClientStats(
  client: string,
  hours = 100
): Promise<ClientStat[]> {
  const res = await api.get<ClientStatsResponse>("/stats", {
    params: { client, hours }
  });
  return res.data.stats;
}

// Site-wide hourly query totals for the dashboard traffic chart.
// GET /stats/site is ordered newest-hour-first; requesting `hours` rows returns
// the most recent N hours, which the chart re-sorts oldest → newest.
export async function getSiteStats(hours = 100): Promise<SiteHourlyStat[]> {
  const res = await api.get<SiteStatsResponse>("/stats/site", {
    params: { limit: hours }
  });
  return res.data.stats;
}

// Per-client hourly counts of newly-seen domains, powering the client-list alert bars.
// GET /stats/new-domains (site-wide) or ?client=<ip> for a single client.
export async function getNewDomainStats(client?: string): Promise<NewDomainStat[]> {
  const res = await api.get<NewDomainStatsResponse>("/stats/new-domains", {
    params: client ? { client } : undefined
  });
  return res.data.stats;
}

// The most recently first-seen (client, domain) pairs for the dashboard table.
// GET /stats/new-domains/recent — ordered newest-first-seen first, capped at `limit`.
export async function getRecentNewDomains(limit = 100): Promise<RecentNewDomain[]> {
  const res = await api.get<RecentNewDomainsResponse>("/stats/new-domains/recent", {
    params: { limit }
  });
  return res.data.domains;
}

// Current resolver runtime counters (cache, blocklist, upstreams, policies) for the dashboard banner.
// GET /stats/runtime — a single snapshot object plus an updated_at timestamp.
export async function getRuntimeStats(): Promise<RuntimeStats> {
  const res = await api.get<RuntimeStatsResponse>("/stats/runtime");
  return res.data.stats;
}

// Per-upstream hourly RTT (avg/max ms) for the upstreams page chart.
// GET /stats/upstreams?hours=<n> — dense series, one row per (hour, address), null-filled.
export async function getUpstreamRttStats(hours = 100): Promise<UpstreamRttStat[]> {
  const res = await api.get<UpstreamRttStatsResponse>("/stats/upstreams", {
    params: { hours }
  });
  return res.data.stats;
}
