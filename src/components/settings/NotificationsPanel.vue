<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "@/stores/settings";
import AsyncState from "@/components/base/AsyncState.vue";
import type { SettingsUpdate } from "@/types/domain";

const store = useSettingsStore();
const { loading, saving } = storeToRefs(store);
const loadError = ref<string | null>(null);
const saveError = ref<string | null>(null);
const ready = ref(false);
const enabled = ref(false);
const webhookUrl = ref("");
const reveal = ref(false);
const saved = ref(false);
const queryTypes = ref<Record<string, boolean>>({});
const typeSearch = ref("");
const baseline = ref<{ enabled: boolean; url: string; queryTypes: Record<string, boolean> }>({
  enabled: false, url: "", queryTypes: {}
});
const queryTypeChanges = computed(() => {
  const changes: Record<string, boolean> = {};
  for (const [type, value] of Object.entries(queryTypes.value)) {
    if (value !== baseline.value.queryTypes[type]) changes[type] = value;
  }
  return changes;
});
const changed = computed(() =>
  enabled.value !== baseline.value.enabled || webhookUrl.value.trim() !== baseline.value.url ||
  Object.keys(queryTypeChanges.value).length > 0
);
const visibleTypes = computed(() => {
  const search = typeSearch.value.trim().toUpperCase();
  return Object.keys(queryTypes.value)
    .filter((type) => type.includes(search))
    .sort((a, b) => a.localeCompare(b));
});

function onEnabledChange(next: boolean | null): void {
  if (saving.value) return;
  if (next && !enabled.value) {
    for (const type of Object.keys(queryTypes.value)) queryTypes.value[type] = true;
  }
  enabled.value = next === true;
}

function queryTypeLabel(type: string): string {
  if (type === "AAAA") return "AAAA (IPv6)";
  if (type === "PTR") return "PTR (reverse DNS)";
  return type;
}

function readSavedValues(): boolean {
  const settings = store.settings;
  if (!settings ||
    typeof settings.discord_notifications_enabled !== "boolean" ||
    typeof settings.discord_webhook_url !== "string" ||
    !settings.discord_query_types ||
    typeof settings.discord_query_types !== "object" ||
    Array.isArray(settings.discord_query_types) ||
    !Object.values(settings.discord_query_types).every((value) => typeof value === "boolean")) {
    loadError.value = "The backend does not support Discord notification settings.";
    return false;
  }
  enabled.value = settings.discord_notifications_enabled;
  webhookUrl.value = settings.discord_webhook_url;
  queryTypes.value = { ...settings.discord_query_types };
  baseline.value = {
    enabled: enabled.value, url: webhookUrl.value, queryTypes: { ...settings.discord_query_types }
  };
  reveal.value = false;
  return true;
}

async function load(): Promise<void> {
  ready.value = false;
  loadError.value = null;
  await store.load();
  loadError.value = store.error;
  if (!loadError.value) ready.value = readSavedValues();
}

async function save(): Promise<void> {
  if (!ready.value || saving.value || !changed.value) return;
  saved.value = false;
  saveError.value = null;
  const url = webhookUrl.value.trim();
  if (enabled.value && !url) {
    saveError.value = "A webhook URL is required when notifications are enabled. Disable notifications to clear it.";
    return;
  }
  if (url && !/^https:\/\/(?:discord\.com|discordapp\.com)\/api\/(?:v[0-9]+\/)?webhooks\/[0-9]+\/[A-Za-z0-9_-]+$/.test(url)) {
    saveError.value = "Enter a valid HTTPS Discord webhook URL without query strings, fragments, credentials, ports, or a trailing slash.";
    return;
  }
  const body: SettingsUpdate = {};
  if (url !== baseline.value.url) body.discord_webhook_url = url;
  if (enabled.value !== baseline.value.enabled) body.discord_notifications_enabled = enabled.value;
  if (Object.keys(queryTypeChanges.value).length) body.discord_query_types = queryTypeChanges.value;
  try {
    await store.save(body);
    saved.value = readSavedValues();
  } catch {
    saveError.value = store.error;
  }
}

watch([enabled, webhookUrl, queryTypes], () => {
  saved.value = false;
  saveError.value = null;
}, { deep: true, flush: "sync" });

onMounted(() => { void load(); });
</script>

<template>
  <div>
    <h2 class="text-h6 mb-2">
      Discord notifications
    </h2>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Notify on a monitored client's first eligible query for a domain. Includes
      allow/block status. Disabled query types do not consume eligibility.
    </p>
    <AsyncState
      :loading="loading"
      :error="loadError"
      :empty="false"
    >
      <v-form
        v-if="ready"
        @submit.prevent="save"
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
          Notification settings saved
        </v-alert>
        <v-switch
          :model-value="enabled"
          label="Enable notifications"
          color="primary"
          :disabled="saving"
          hide-details
          class="mb-4"
          @update:model-value="onEnabledChange"
        />
        <v-text-field
          v-model="webhookUrl"
          label="Webhook URL"
          :type="reveal ? 'text' : 'password'"
          :disabled="saving"
          variant="outlined"
          density="compact"
          autocomplete="off"
          autocapitalize="none"
          :spellcheck="false"
          hint="Configure the URL before enabling. To clear an enabled webhook, disable notifications and clear the URL, then save."
          persistent-hint
          class="mb-4"
        >
          <template #append-inner>
            <v-btn
              :icon="reveal ? 'mdi-eye-off' : 'mdi-eye'"
              :aria-label="reveal ? 'Hide webhook URL' : 'Show webhook URL'"
              :disabled="saving"
              variant="text"
              size="small"
              @click="reveal = !reveal"
            />
          </template>
        </v-text-field>
        <h3 class="text-subtitle-1 mb-2">
          Query types ({{ Object.keys(queryTypes).length }})
        </h3>
        <p class="text-body-2 text-medium-emphasis mb-2">
          Turning notifications on selects all query types. Deselect individual
          types below, then save.
        </p>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Only selected query types can trigger an alert. If a domain is first
          queried using an unselected type, its first later selected-type query
          can still alert. Each client/domain pair alerts once, not once per type.
        </p>
        <p class="text-caption text-medium-emphasis mb-2">
          These controls affect only Discord alerts, not DNS resolution, query
          recording, or the newly-seen domain feed.
        </p>
        <v-text-field
          v-model="typeSearch"
          label="Search query types"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-2"
        />
        <v-row class="query-type-grid mb-4">
          <v-col
            v-for="type in visibleTypes"
            :key="type"
            cols="12"
            sm="6"
            md="4"
          >
            <v-switch
              v-model="queryTypes[type]"
              :label="queryTypeLabel(type)"
              :disabled="saving"
              color="primary"
              density="compact"
              hide-details
            />
          </v-col>
        </v-row>
        <p
          v-if="!visibleTypes.length"
          class="text-body-2 text-medium-emphasis mb-4"
        >
          No matching query types.
        </p>
        <v-btn
          type="submit"
          color="primary"
          :loading="saving"
          :disabled="saving || !changed"
        >
          Save
        </v-btn>
      </v-form>
    </AsyncState>
    <v-btn
      v-if="loadError && !loading"
      variant="tonal"
      @click="load"
    >
      Retry
    </v-btn>
  </div>
</template>
