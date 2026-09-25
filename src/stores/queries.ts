import { defineStore } from "pinia";
import { ref } from "vue";
import { clearQueries, listQueries } from "@/services/queries";
import { apiErrorMessage } from "@/services/errors";
import type { QueryLog } from "@/types/domain";

const PAGE_SIZE = 50;

export const useQueriesStore = defineStore("queries", () => {
  const items = ref<QueryLog[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const page = ref(1);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const offset = (page.value - 1) * PAGE_SIZE;
      const res = await listQueries(PAGE_SIZE, offset);
      items.value = res.items;
      total.value = res.total;
    } catch (e) {
      error.value = apiErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function setPage(next: number): Promise<void> {
    page.value = next;
    await load();
  }

  async function clear(): Promise<void> {
    await clearQueries();
    page.value = 1;
    await load();
  }

  return { items, total, loading, error, page, pageSize: PAGE_SIZE, load, setPage, clear };
});
