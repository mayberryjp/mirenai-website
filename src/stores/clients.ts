import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { listClients } from "@/services/clients";
import { listHosts } from "@/services/hosts";
import { apiErrorMessage } from "@/services/errors";
import type { ClientSummary, QueryLog } from "@/types/domain";

// Shared cache of the client roster (derived from the query log), used by the
// ClientList sidebar and the client detail view.
export const useClientsStore = defineStore("clients", () => {
  const clients = ref<ClientSummary[]>([]);
  const rows = ref<QueryLog[]>([]);
  // Map of client IP -> device_name (only entries with a non-empty name).
  const hostNames = ref<Record<string, string>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const roster = await listClients();
      clients.value = roster.clients;
      rows.value = roster.rows;
      loaded.value = true;
    } catch (e) {
      error.value = apiErrorMessage(e);
    } finally {
      loading.value = false;
    }

    // Best-effort: device names are a nicety, so a /hosts failure must not
    // break the client roster.
    try {
      const map: Record<string, string> = {};
      for (const h of await listHosts()) {
        const name = h.device_name?.trim();
        if (name) map[h.ip] = name;
      }
      hostNames.value = map;
    } catch {
      hostNames.value = {};
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

  return {
    clients,
    rows,
    hostNames,
    loading,
    error,
    loaded,
    total,
    totalQueries,
    load,
    summaryFor,
    rowsFor,
    nameFor
  };
});
