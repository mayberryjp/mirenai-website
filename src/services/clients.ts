import api from "@/services/api";
import { listQueries } from "@/services/queries";
import type {
  ClientModeState,
  ClientSummary,
  QueryLog,
  SettableClientMode
} from "@/types/domain";

// mirenai has no dedicated clients endpoint, so the roster is derived from the
// query log: pull a large slice in one call and aggregate by client.
const CLIENT_SCAN_LIMIT = 5000;

export interface ClientRoster {
  clients: ClientSummary[];
  rows: QueryLog[];
}

export async function listClients(): Promise<ClientRoster> {
  const { items } = await listQueries(CLIENT_SCAN_LIMIT, 0);
  return { clients: aggregateClients(items), rows: items };
}

// Collapse query-log rows into one summary per distinct client, busiest first.
export function aggregateClients(rows: QueryLog[]): ClientSummary[] {
  const byClient = new Map<
    string,
    { total: number; domains: Set<string>; last: string | null }
  >();

  for (const row of rows) {
    const entry =
      byClient.get(row.client) ?? { total: 0, domains: new Set<string>(), last: null };
    entry.total += row.count;
    entry.domains.add(row.domain);
    // Timestamps are same-format wall-clock, so a lexicographic compare is chronological.
    if (!entry.last || row.last_seen > entry.last) entry.last = row.last_seen;
    byClient.set(row.client, entry);
  }

  return [...byClient.entries()]
    .map(([client, e]) => ({
      client,
      total_queries: e.total,
      domain_count: e.domains.size,
      last_seen: e.last
    }))
    .sort((a, b) => b.total_queries - a.total_queries);
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
