import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { listClients } from "@/services/clients";
import { apiErrorMessage } from "@/services/errors";
import type { ClientSummary, QueryLog } from "@/types/domain";

// Shared cache of the client roster (derived from the query log), used by the
// ClientList sidebar and the client detail view.
export const useClientsStore = defineStore("clients", () => {
  const clients = ref<ClientSummary[]>([]);
  const rows = ref<QueryLog[]>([]);
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

  return {
    clients,
    rows,
    loading,
    error,
    loaded,
    total,
    totalQueries,
    load,
    summaryFor,
    rowsFor
  };
});
