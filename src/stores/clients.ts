import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { listClientQueryRows, rosterFromHosts } from "@/services/clients";
import { listHosts } from "@/services/hosts";
import { getNewDomainStats } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import type { ClientSummary, NewDomainStat, QueryLog } from "@/types/domain";

// Shared cache of the client roster (derived from the query log), used by the
// ClientList sidebar and the client detail view.
export const useClientsStore = defineStore("clients", () => {
  const clients = ref<ClientSummary[]>([]);
  const rows = ref<QueryLog[]>([]);
  // Map of client IP -> device_name (only entries with a non-empty name).
  const hostNames = ref<Record<string, string>>({});
  // Map of client IP -> icon key (only entries with an icon set).
  const hostIcons = ref<Record<string, string>>({});
  // Map of client IP -> MAC address (only entries with one recorded).
  const hostMacs = ref<Record<string, string>>({});
  // Per-client hourly new-domain counts feeding the client-list alert bars.
  const newDomainRows = ref<NewDomainStat[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      // The client roster is the device inventory from /hosts; device names and
      // icons come from the same rows.
      const hosts = await listHosts();
      clients.value = rosterFromHosts(hosts);
      const names: Record<string, string> = {};
      const icons: Record<string, string> = {};
      const macs: Record<string, string> = {};
      for (const h of hosts) {
        const name = h.device_name?.trim();
        if (name) names[h.ip] = name;
        if (h.icon) icons[h.ip] = h.icon;
        if (h.mac_address) macs[h.ip] = h.mac_address;
      }
      hostNames.value = names;
      hostIcons.value = icons;
      hostMacs.value = macs;
      loaded.value = true;
    } catch (e) {
      error.value = apiErrorMessage(e);
    } finally {
      loading.value = false;
    }

    // Best-effort: per-client query-log rows feed the detail view's domain
    // table, so a /queries failure must not break the client roster.
    try {
      rows.value = await listClientQueryRows();
    } catch {
      rows.value = [];
    }

    // Best-effort: the alert bars are supplementary, so a /stats/new-domains
    // failure must not break the client roster.
    try {
      newDomainRows.value = await getNewDomainStats();
    } catch {
      newDomainRows.value = [];
    }
  }

  const total = computed(() => clients.value.length);
  const totalQueries = computed(() =>
    clients.value.reduce((sum, c) => sum + c.total_queries, 0)
  );

  function summaryFor(client: string): ClientSummary | undefined {
    return clients.value.find((c) => c.client === client);
  }

  function rowsFor(client: string): QueryLog[] {
    return rows.value.filter((r) => r.client === client);
  }

  // Display label: the device name when set, otherwise the raw IP.
  function nameFor(client: string): string {
    return hostNames.value[client] ?? client;
  }

  // Device icon key for a client (e.g. "TV"), or null when none is set.
  function iconFor(client: string): string | null {
    return hostIcons.value[client] ?? null;
  }

  // MAC address for a client, or null when none is recorded.
  function macFor(client: string): string | null {
    return hostMacs.value[client] ?? null;
  }

  // Number of most-recent hourly buckets shown as alert bars per client.
  const NEW_DOMAIN_HOURS = 8;

  // Shared time axis (oldest → newest) across the most recent NEW_DOMAIN_HOURS
  // buckets present in the data, so every client's bars line up on the same hours.
  const newDomainAxis = computed<string[]>(() => {
    const hours = [...new Set(newDomainRows.value.map((r) => r.hour_start))].sort();
    return hours.slice(-NEW_DOMAIN_HOURS);
  });

  // client IP -> new-domain count per axis hour (0 where the client had none).
  const newDomainSeries = computed<Record<string, number[]>>(() => {
    const axis = newDomainAxis.value;
    const slot = new Map(axis.map((hour, i) => [hour, i] as const));
    const series: Record<string, number[]> = {};
    for (const row of newDomainRows.value) {
      const i = slot.get(row.hour_start);
      if (i === undefined) continue;
      const counts = (series[row.client] ??= Array.from({ length: axis.length }, () => 0));
      counts[i] = row.new_domains;
    }
    return series;
  });

  // Alert-bar counts for a client. Always NEW_DOMAIN_HOURS slots so the track is
  // visible even with no recent activity; real counts sit at the newest (right) edge.
  function newDomainsFor(client: string): number[] {
    const counts = newDomainSeries.value[client] ?? [];
    const bars = Array.from({ length: NEW_DOMAIN_HOURS }, () => 0);
    const offset = NEW_DOMAIN_HOURS - counts.length;
    counts.forEach((n, i) => {
      bars[offset + i] = n;
    });
    return bars;
  }

  return {
    clients,
    rows,
    hostNames,
    hostIcons,
    hostMacs,
    loading,
    error,
    loaded,
    total,
    totalQueries,
    load,
    summaryFor,
    rowsFor,
    nameFor,
    iconFor,
    macFor,
    newDomainsFor
  };
});
