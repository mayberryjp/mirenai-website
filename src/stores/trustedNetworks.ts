import { defineStore } from "pinia";
import { ref } from "vue";
import {
  createTrustedNetwork,
  deleteTrustedNetwork,
  listTrustedNetworks
} from "@/services/trustedNetworks";
import { apiErrorMessage } from "@/services/errors";
import type { TrustedNetwork, TrustedNetworkCreate } from "@/types/domain";

export const useTrustedNetworksStore = defineStore("trustedNetworks", () => {
  const items = ref<TrustedNetwork[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await listTrustedNetworks();
      items.value = page.items;
      total.value = page.total;
    } catch (e) {
      error.value = apiErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function create(body: TrustedNetworkCreate): Promise<void> {
    await createTrustedNetwork(body);
    await load();
  }

  async function remove(id: number): Promise<void> {
    await deleteTrustedNetwork(id);
    await load();
  }

  return { items, total, loading, error, load, create, remove };
});
