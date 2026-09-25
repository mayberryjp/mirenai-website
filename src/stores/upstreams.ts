import { defineStore } from "pinia";
import { ref } from "vue";
import {
  createUpstream,
  deleteUpstream,
  listUpstreams,
  updateUpstream
} from "@/services/upstreams";
import { apiErrorMessage } from "@/services/errors";
import type { Upstream, UpstreamCreate, UpstreamUpdate } from "@/types/domain";

export const useUpstreamsStore = defineStore("upstreams", () => {
  const items = ref<Upstream[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await listUpstreams();
      items.value = page.items;
      total.value = page.total;
    } catch (e) {
      error.value = apiErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function create(body: UpstreamCreate): Promise<void> {
    await createUpstream(body);
    await load();
  }

  async function update(id: number, body: UpstreamUpdate): Promise<void> {
    await updateUpstream(id, body);
    await load();
  }

  async function remove(id: number): Promise<void> {
    await deleteUpstream(id);
    await load();
  }

  return { items, total, loading, error, load, create, update, remove };
});
