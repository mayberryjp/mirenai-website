import api from "@/services/api";
import { listQueries } from "@/services/queries";
import type {
  ClientModeState,
  ClientSummary,
  Host,
  QueryLog,
  SettableClientMode
} from "@/types/domain";

// mirenai has no dedicated clients endpoint. The roster is the device inventory
// from /hosts; a single client's query rows come from the query log, filtered
// by client, when its detail page is opened.
const CLIENT_QUERY_LIMIT = 5000;

// Build the client roster from /hosts, busiest first to match the sidebar's
// query-count ordering.
export function rosterFromHosts(hosts: Host[]): ClientSummary[] {
  return hosts
    .map((h) => ({
      client: h.ip,
      total_queries: h.query_count,
      domain_count: 0,
      last_seen: h.last_seen
    }))
    .sort((a, b) => b.total_queries - a.total_queries);
}

// One client's query-log rows (GET /queries?client=<ip>), feeding the per-client
// domain table on the detail page.
export async function listClientQueryRows(client: string): Promise<QueryLog[]> {
  const { items } = await listQueries(CLIENT_QUERY_LIMIT, 0, undefined, client);
  return items;
}

// Client response mode — GET/PUT /clients/{ip}/mode return a flat object.
export async function getClientMode(ip: string): Promise<ClientModeState> {
  const res = await api.get<ClientModeState>(`/clients/${encodeURIComponent(ip)}/mode`);
  return res.data;
}

// Idempotent (always 200); backend rejects "override" via the SettableClientMode type.
export async function setClientMode(
  ip: string,
  mode: SettableClientMode
): Promise<ClientModeState> {
  const res = await api.put<ClientModeState>(
    `/clients/${encodeURIComponent(ip)}/mode`,
    { mode }
  );
  return res.data;
}
