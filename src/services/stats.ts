import api from "@/services/api";
import type {
  ClientHistoryResponse,
  ClientHourlyStat,
  SiteHourlyStat,
  SiteStatsResponse
} from "@/types/domain";

// Per-client DNS query history for the detail chart.
//
// NOTE: this targets the planned mirenai endpoint
//   GET /clients/{client}/history?hours=100  ->  { status, client, history: [...] }
// which does not exist yet. Until the backend ships it the request fails and the
// chart shows its empty/error state; when the endpoint lands no frontend change
// is needed.
export async function getClientHistory(
  client: string,
  hours = 100
): Promise<ClientHourlyStat[]> {
  const res = await api.get<ClientHistoryResponse>(
    `/clients/${encodeURIComponent(client)}/history`,
    { params: { hours } }
  );
  return res.data.history;
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
