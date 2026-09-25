import { defineStore } from "pinia";
import { ref } from "vue";
import {
  createBlocklist,
  deleteBlocklist,
  listBlocklists,
  refreshBlocklist,
  updateBlocklist
} from "@/services/blocklists";
import { apiErrorMessage } from "@/services/errors";
import type { Blocklist, BlocklistCreate, BlocklistUpdate } from "@/types/domain";

export const useBlocklistsStore = defineStore("blocklists", () => {
  const items = ref<Blocklist[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const refreshingId = ref<number | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await listBlocklists();
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

  return { items, total, loading, error, refreshingId, load, create, update, remove, refresh };
});
