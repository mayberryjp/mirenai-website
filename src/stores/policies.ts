import { defineStore } from "pinia";
import { ref } from "vue";
import {
  createPolicy,
  deletePolicy,
  listPolicies,
  updatePolicy
} from "@/services/policies";
import { apiErrorMessage } from "@/services/errors";
import type { Policy, PolicyCreate, PolicyUpdate } from "@/types/domain";

export const usePoliciesStore = defineStore("policies", () => {
  const items = ref<Policy[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const page = await listPolicies();
      items.value = page.items;
      total.value = page.total;
    } catch (e) {
      error.value = apiErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  // Write actions let errors propagate so dialogs can surface 409/422 detail.
  async function create(body: PolicyCreate): Promise<void> {
    await createPolicy(body);
    await load();
  }

  async function update(id: number, body: PolicyUpdate): Promise<void> {
    await updatePolicy(id, body);
    await load();
  }

  async function remove(id: number): Promise<void> {
    await deletePolicy(id);
    await load();
  }

  return { items, total, loading, error, load, create, update, remove };
});
