import api from "@/services/api";
import type {
  ClientStat,
  ClientStatsResponse,
  SiteHourlyStat,
  SiteStatsResponse
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
