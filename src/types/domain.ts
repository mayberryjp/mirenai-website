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
  name: string;
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

// Per-client hourly query history for the detail chart. Served by the future
// GET /clients/{client}/history endpoint (see services/stats.ts).
export interface ClientHourlyStat {
  hour: string; // ISO hour bucket, container-local wall-clock (no offset)
  queries: number; // total queries in the hour
  blocked: number; // subset that were denied/blocklisted
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

export type DomainList = OkEnvelope & { domains: string[]; total: number };

export type QueryList = OkEnvelope & { queries: QueryLog[]; total: number };

export type SettingsResponse = OkEnvelope & { settings: Settings };

export type HealthResponse = OkEnvelope & { service: string };

// Future endpoint: GET /clients/{client}/history?hours=100 (see services/stats.ts).
export type ClientHistoryResponse = OkEnvelope & {
  client: string;
  history: ClientHourlyStat[];
};

// A paginated slice returned by list services.
export interface Page<T> {
  items: T[];
  total: number;
}
