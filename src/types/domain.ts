// Domain resource types derived from the mirenai frontend-integration spec §9.
// Datetime fields are ISO strings in container-local time (no offset — do not treat as UTC).

import type { OkEnvelope } from "@/types/api";

// ---- Policies ----
export type PolicyAction = "forward" | "override" | "deny" | "blocklist";

export interface Policy {
  id: number;
  client: string; // IP or "*"
  domain: string; // exact | "*.suffix" | "*"
  action: PolicyAction;
  override_response: string | null; // comma-separated IP(s)
  override_ttl: number;
  enabled: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PolicyCreate {
  client: string;
  domain: string;
  action: PolicyAction;
  override_response?: string | null;
  override_ttl?: number; // default 300
  enabled?: boolean; // default true
  description?: string | null;
}
export type PolicyUpdate = Partial<PolicyCreate>;

// ---- Upstreams ----
export type UpstreamProtocol = "udp" | "tcp";

export interface Upstream {
  id: number;
  name: string | null;
  address: string;
  port: number;
  protocol: UpstreamProtocol;
  enabled: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface UpstreamCreate {
  address: string;
  name?: string | null;
  port?: number; // default 53
  protocol?: UpstreamProtocol; // default "udp"
  enabled?: boolean; // default true
  priority?: number; // default 100
}
export type UpstreamUpdate = Partial<UpstreamCreate>;

// ---- Blocklists ----
export interface Blocklist {
  id: number;
  name: string;
  url: string;
  update_interval_hours: number;
  enabled: boolean;
  domain_count: number; // read-only
  last_downloaded_at: string | null; // read-only
  last_status: string | null; // read-only
  created_at: string;
  updated_at: string;
}

export interface BlocklistCreate {
  url: string;
  update_interval_hours?: number; // default 24, >= 1
  enabled?: boolean; // default true
}
export type BlocklistUpdate = Partial<BlocklistCreate>;

// ---- Query log ----
export interface QueryLog {
  id: number;
  client: string;
  domain: string;
  qtype: string;
  count: number;
  last_action: PolicyAction | null;
  first_seen: string;
  last_seen: string;
}

// ---- Clients ----
// The client roster is derived from the query log (one entry per distinct
// QueryLog.client) — see services/clients.ts.
export interface ClientSummary {
  client: string; // IP address
  total_queries: number; // sum of QueryLog.count
  domain_count: number; // distinct domains seen
  last_seen: string | null; // most recent last_seen across the client's rows
}

// Client response mode — GET/PUT /clients/{ip}/mode (flat, non-enveloped response).
// GET may report "override" (advanced per-domain rule); PUT only accepts the settable modes.
export type ClientMode = "forward" | "deny" | "blocklist" | "default" | "override";
export type SettableClientMode = Exclude<ClientMode, "override">;

export interface ClientModeState {
  status: "ok";
  client: string;
  mode: ClientMode;
  policy_id: number | null;
}

// ---- Hosts ----
// Server-recorded device rows, one per client IP. Only device_name is writable.
export interface Host {
  id: number;
  ip: string;
  device_name: string | null;
  query_count: number; // read-only
  first_seen: string; // read-only
  last_seen: string; // read-only
}

// Per-hour result breakdown shared by the site and per-client traffic charts.
export interface HourlyResultStat {
  hour_start: string; // ISO hour bucket, container-local wall-clock (no offset)
  forwarded: number;
  cached: number;
  overridden: number;
  denied: number;
  blocked: number;
  servfail: number;
}

// Site-wide hourly totals across all clients. Served by GET /stats/site.
export interface SiteHourlyStat extends HourlyResultStat {
  total: number;
  clients: number;
}

// Per-client hourly stats. Served by GET /stats?client=<ip>&hours=<n>.
export interface ClientStat extends HourlyResultStat {
  id: number;
  client: string;
  total: number;
}

// ---- Settings ----
export interface Settings {
  cache_enabled: boolean;
  cache_max_ttl: number;
  cache_min_ttl: number;
  cache_max_entries: number;
  forward_timeout: number;
  default_action: "deny" | "forward";
  refresh_seconds: number;
  query_flush_seconds: number;
  log_queries: boolean;
}
export type SettingsUpdate = Partial<Settings>;

// ---- Single-resource + collection responses ----
export type PolicyResponse = OkEnvelope & { policy: Policy };
export type PolicyList = OkEnvelope & { policies: Policy[]; total: number };

export type UpstreamResponse = OkEnvelope & { upstream: Upstream };
export type UpstreamList = OkEnvelope & { upstreams: Upstream[]; total: number };

export type BlocklistResponse = OkEnvelope & { blocklist: Blocklist };
export type BlocklistList = OkEnvelope & { blocklists: Blocklist[]; total: number };

export type HostResponse = OkEnvelope & { host: Host };
export type HostList = OkEnvelope & { hosts: Host[]; total: number };

export type DomainList = OkEnvelope & { domains: string[]; total: number };

export type QueryList = OkEnvelope & { queries: QueryLog[]; total: number };

export type SettingsResponse = OkEnvelope & { settings: Settings };

export type HealthResponse = OkEnvelope & { service: string };

// GET /stats?client=<ip>&hours=<n> — per-client hourly stats.
export type ClientStatsResponse = OkEnvelope & {
  stats: ClientStat[];
  total: number;
};

// GET /stats/site — site-wide hourly totals (newest hour first, paginated).
export type SiteStatsResponse = OkEnvelope & {
  stats: SiteHourlyStat[];
  total: number;
};

// A paginated slice returned by list services.
export interface Page<T> {
  items: T[];
  total: number;
}
