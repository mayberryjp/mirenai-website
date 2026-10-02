import { defineStore } from "pinia";
import { ref } from "vue";
import {
  createBlocklist,
  createBlocklistOverride,
  deleteBlocklist,
  deleteBlocklistOverride,
  listBlocklistOverrides,
  listBlocklists,
  refreshBlocklist,
  updateBlocklist
} from "@/services/blocklists";
import { apiErrorMessage } from "@/services/errors";
import type { Blocklist, BlocklistCreate, BlocklistOverride, BlocklistUpdate } from "@/types/domain";

export const useBlocklistsStore = defineStore("blocklists", () => {
  const items = ref<Blocklist[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const refreshingId = ref<number | null>(null);

  const overrides = ref<BlocklistOverride[]>([]);
  const overridesTotal = ref(0);
  const overridesLoading = ref(false);
  const overridesError = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await listBlocklists(100);
      items.value = page.items;
      total.value = page.total;
    } catch (e) {
      error.value = apiErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function create(body: BlocklistCreate): Promise<void> {
    await createBlocklist(body);
    await load();
  }

  async function update(id: number, body: BlocklistUpdate): Promise<void> {
    await updateBlocklist(id, body);
    await load();
  }

  async function remove(id: number): Promise<void> {
    await deleteBlocklist(id);
    await load();
  }

  async function refresh(id: number): Promise<void> {
    refreshingId.value = id;
    try {
      await refreshBlocklist(id);
      await load();
    } finally {
      refreshingId.value = null;
    }
  }

  async function loadOverrides(): Promise<void> {
    overridesLoading.value = true;
    overridesError.value = null;
    try {
      const page = await listBlocklistOverrides();
      overrides.value = page.items;
      overridesTotal.value = page.total;
    } catch (e) {
      overridesError.value = apiErrorMessage(e);
    } finally {
      overridesLoading.value = false;
    }
  }

  async function addOverride(domain: string): Promise<void> {
    await createBlocklistOverride({ domain });
    await loadOverrides();
  }

  async function removeOverride(id: number): Promise<void> {
    await deleteBlocklistOverride(id);
    await loadOverrides();
  }

  return {
    items,
    total,
    loading,
    error,
    refreshingId,
    overrides,
    overridesTotal,
    overridesLoading,
    overridesError,
    load,
    create,
    update,
    remove,
    refresh,
    loadOverrides,
    addOverride,
    removeOverride
  };
});
