import { defineStore } from "pinia";
import { ref } from "vue";
import { getSettings, updateSettings } from "@/services/settings";
import { apiErrorMessage } from "@/services/errors";
import type { Settings, SettingsUpdate } from "@/types/domain";

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<Settings | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      settings.value = await getSettings();
    } catch (e) {
      error.value = apiErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function save(body: SettingsUpdate): Promise<void> {
    saving.value = true;
    error.value = null;
    try {
      settings.value = await updateSettings(body);
    } catch (e) {
      error.value = apiErrorMessage(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  return { settings, loading, saving, error, load, save };
});
