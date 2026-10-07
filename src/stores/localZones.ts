import { defineStore } from "pinia";
import { ref } from "vue";
import {
  createLocalZone,
  deleteLocalZone,
  listLocalZones,
  refreshLocalZone
} from "@/services/localZones";
import { apiErrorMessage } from "@/services/errors";
import type { LocalZone, LocalZoneCreate } from "@/types/domain";

export const useLocalZonesStore = defineStore("localZones", () => {
  const items = ref<LocalZone[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const refreshingId = ref<number | null>(null);
  const refreshingAll = ref(false);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await listLocalZones();
      items.value = page.items;
      total.value = page.total;
    } catch (e) {
      error.value = apiErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  // Write actions let errors propagate so dialogs can surface 409/422 detail.
  async function create(body: LocalZoneCreate): Promise<void> {
    await createLocalZone(body);
    await load();
  }

  async function remove(id: number): Promise<void> {
    await deleteLocalZone(id);
    await load();
  }

  // Forced synchronous refresh; surfaces 502 download_failed to the caller.
  async function refresh(id: number): Promise<void> {
    refreshingId.value = id;
    try {
      await refreshLocalZone(id);
      await load();
    } finally {
      refreshingId.value = null;
    }
  }

  // Refresh every zone concurrently, then reload once. Throws a summary when any
  // failed so the panel can surface it (per-zone 502 detail isn't aggregated).
  async function refreshAll(): Promise<void> {
    refreshingAll.value = true;
    try {
      const results = await Promise.allSettled(
        items.value.map((zone) => refreshLocalZone(zone.id))
      );
      await load();
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        throw new Error(`${failed} of ${results.length} sources failed to refresh.`);
      }
    } finally {
      refreshingAll.value = false;
    }
  }

  return {
    items,
    total,
    loading,
    error,
    refreshingId,
    refreshingAll,
    load,
    create,
    remove,
    refresh,
    refreshAll
  };
});
