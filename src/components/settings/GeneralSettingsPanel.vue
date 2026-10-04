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
  <AsyncState
    :loading="loading"
    :error="error"
    :empty="false"
  >
    <div
      v-if="form"
      class="general-settings"
    >
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

      <div class="settings-head">
        Setting
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          Default action
        </div>
        <div class="setting-control">
          <v-select
            v-model="form.default_action"
            :items="defaultActions"
            density="compact"
            variant="outlined"
            hide-details
            class="control-input"
          />
          <p class="setting-desc">
            When no more specific policy exists. Policy is inherited by new clients.
          </p>
        </div>
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          IPv6 (AAAA) support
        </div>
        <div class="setting-control">
          <v-switch
            v-model="form.ipv6_enabled"
            color="primary"
            density="compact"
            hide-details
            class="control-switch"
          />
          <p class="setting-desc">
            When off, AAAA queries return NODATA so clients fall back to IPv4 (A).
          </p>
        </div>
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          Drop private PTR
        </div>
        <div class="setting-control">
          <v-switch
            v-model="form.drop_private_ptr"
            color="primary"
            density="compact"
            hide-details
            class="control-switch"
          />
          <p class="setting-desc">
            Respond NODATA and don't log RFC1918 PTR requests. DNS entries loaded through local-domains feature excluded.
          </p>
        </div>
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          DNS cache
        </div>
        <div class="setting-control">
          <v-switch
            v-model="form.cache_enabled"
            color="primary"
            density="compact"
            hide-details
            class="control-switch"
          />
          <p class="setting-desc">
            Cache DNS responses longer than authoritative DNS TTL — helps performance, may serve stale results.
          </p>
        </div>
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          Cache max TTL (s)
        </div>
        <div class="setting-control">
          <v-text-field
            v-model.number="form.cache_max_ttl"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
            class="control-input"
          />
          <p class="setting-desc">
            Maximum TTL honored from an upstream — a longer upstream TTL is capped to this (e.g. an upstream 86401 is cached for 86400). Effectively the maximum TTL allowed.
          </p>
        </div>
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          Cache min TTL (s)
        </div>
        <div class="setting-control">
          <v-text-field
            v-model.number="form.cache_min_ttl"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
            class="control-input"
          />
          <p class="setting-desc">
            Raises short TTLs up to this value to increase cache time (e.g. a TTL of 1 becomes this). Higher improves the cache hit rate.
          </p>
        </div>
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          Cache max entries
        </div>
        <div class="setting-control">
          <v-text-field
            v-model.number="form.cache_max_entries"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
            class="control-input"
          />
          <p class="setting-desc">
            Maximum number of DNS entries cached (LRU).
          </p>
        </div>
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          Forward timeout (s)
        </div>
        <div class="setting-control">
          <v-text-field
            v-model.number="form.forward_timeout"
            type="number"
            step="0.1"
            density="compact"
            variant="outlined"
            hide-details
            class="control-input"
          />
          <p class="setting-desc">
            Seconds to wait for an upstream reply before failing over to the next resolver.
          </p>
        </div>
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          Config refresh interval (s)
        </div>
        <div class="setting-control">
          <v-text-field
            v-model.number="form.refresh_seconds"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
            class="control-input"
          />
          <p class="setting-desc">
            How often to check for configuration changes.
          </p>
        </div>
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          Query flush interval (s)
        </div>
        <div class="setting-control">
          <v-text-field
            v-model.number="form.query_flush_seconds"
            type="number"
            density="compact"
            variant="outlined"
            hide-details
            class="control-input"
          />
          <p class="setting-desc">
            How often to write query stats to the database.
          </p>
        </div>
      </div>
      <v-divider />

      <div class="setting-row">
        <div class="setting-name">
          Log queries
        </div>
        <div class="setting-control">
          <v-switch
            v-model="form.log_queries"
            color="primary"
            density="compact"
            hide-details
            class="control-switch"
          />
          <p class="setting-desc">
            Record per-client query names and counts for the query log.
          </p>
        </div>
      </div>
      <v-divider />

      <div class="d-flex justify-end mt-6">
        <v-btn
          color="primary"
          :loading="saving"
          @click="save"
        >
          Save settings
        </v-btn>
      </div>
    </div>
  </AsyncState>
</template>

<style scoped>
.settings-head {
  padding: 0 4px 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #8b98a5;
}

.setting-row {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 24px;
  align-items: start;
  padding: 18px 4px;
}

.setting-name {
  font-weight: 700;
  color: #e6edf3;
}

.setting-control {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-input {
  max-width: 240px;
}

.control-switch {
  margin-top: -4px;
}

.setting-desc {
  margin: 0;
  max-width: 760px;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: #8b98a5;
}

@media (max-width: 700px) {
  .setting-row {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 16px 4px;
  }
}
</style>
