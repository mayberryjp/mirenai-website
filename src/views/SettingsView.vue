<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import { apiErrorMessage } from "@/services/errors";
import AsyncState from "@/components/base/AsyncState.vue";
import type { Settings } from "@/types/domain";

const store = useSettingsStore();
const { settings, loading, saving, error } = storeToRefs(store);

const defaultActions: Settings["default_action"][] = ["deny", "forward"];

const form = ref<Settings | null>(null);
const saveError = ref<string | null>(null);
const saved = ref(false);

// Keep a local editable copy so the form doesn't mutate store state directly.
watch(
  settings,
  (value) => {
    form.value = value ? { ...value } : null;
  },
  { immediate: true }
);

async function save(): Promise<void> {
  if (!form.value) return;
  saveError.value = null;
  saved.value = false;
  try {
    await store.save({ ...form.value });
    saved.value = true;
  } catch (e) {
    saveError.value = apiErrorMessage(e);
  }
}

onMounted(() => {
  void store.load();
});
</script>

<template>
  <div>
    <h1 class="text-h5 mb-4">
      Settings
    </h1>

    <AsyncState
      :loading="loading"
      :error="error"
      :empty="false"
    >
      <v-card
        variant="tonal"
        max-width="640"
      >
        <v-card-text v-if="form">
          <v-alert
            v-if="saveError"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ saveError }}
          </v-alert>
          <v-alert
            v-if="saved"
            type="success"
            variant="tonal"
            class="mb-4"
          >
            Settings saved.
          </v-alert>

          <v-select
            v-model="form.default_action"
            :items="defaultActions"
            label="Default action (no policy match)"
          />
          <v-switch
            v-model="form.cache_enabled"
            label="DNS cache enabled"
            color="primary"
          />
          <v-text-field
            v-model.number="form.cache_max_ttl"
            type="number"
            label="Cache max TTL (s)"
          />
          <v-text-field
            v-model.number="form.cache_min_ttl"
            type="number"
            label="Cache min TTL (s)"
          />
          <v-text-field
            v-model.number="form.cache_max_entries"
            type="number"
            label="Cache max entries (LRU)"
          />
          <v-text-field
            v-model.number="form.forward_timeout"
            type="number"
            step="0.1"
            label="Forward timeout (s)"
          />
          <v-text-field
            v-model.number="form.refresh_seconds"
            type="number"
            label="Config refresh interval (s)"
          />
          <v-text-field
            v-model.number="form.query_flush_seconds"
            type="number"
            label="Query flush interval (s)"
          />
          <v-switch
            v-model="form.log_queries"
            label="Log queries"
            color="primary"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="primary"
            :loading="saving"
            @click="save"
          >
            Save settings
          </v-btn>
        </v-card-actions>
      </v-card>
    </AsyncState>
  </div>
</template>
