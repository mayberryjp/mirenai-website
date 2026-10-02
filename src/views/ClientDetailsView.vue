<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useClientsStore } from "@/stores/clients";
import { getClientHistory } from "@/services/stats";
import { findHostByIp, updateHost } from "@/services/hosts";
import { apiErrorMessage } from "@/services/errors";
import ClientQueriesChart from "@/components/client-details/ClientQueriesChart.vue";
import type { ClientHourlyStat, Host, QueryLog } from "@/types/domain";

const route = useRoute();
const store = useClientsStore();

const client = computed(() => route.params.client as string);

const history = ref<ClientHourlyStat[]>([]);
const historyLoading = ref(true);
const historyError = ref<string | null>(null);

// Per-client host record (carries the editable flags). Looked up by IP.
const host = ref<Host | null>(null);
const hostLoading = ref(true);
const hostError = ref<string | null>(null);
const flagSaving = ref(false);
const flagError = ref<string | null>(null);

// New domain monitoring: true = Include, false = Exclude. Defaults to Include
// until the host record loads.
const newDomainMonitoring = computed(() => host.value?.flag_new_domains ?? true);

const summary = computed(() => store.summaryFor(client.value));
const domainRows = computed<QueryLog[]>(() =>
  [...store.rowsFor(client.value)].sort((a, b) => b.count - a.count)
);

const headers = [
  { title: "Domain", key: "domain" },
  { title: "Type", key: "qtype" },
  { title: "Count", key: "count" },
  { title: "Last action", key: "last_action" },
  { title: "Last seen", key: "last_seen" }
];

async function loadHistory(): Promise<void> {
  historyLoading.value = true;
  historyError.value = null;
  try {
    history.value = await getClientHistory(client.value, 100);
  } catch (e) {
    historyError.value = apiErrorMessage(e);
    history.value = [];
  } finally {
    historyLoading.value = false;
  }
}

async function loadHost(): Promise<void> {
  hostLoading.value = true;
  hostError.value = null;
  flagError.value = null;
  try {
    host.value = await findHostByIp(client.value);
  } catch (e) {
    hostError.value = apiErrorMessage(e);
    host.value = null;
  } finally {
    hostLoading.value = false;
  }
}

async function setNewDomainMonitoring(value: boolean): Promise<void> {
  const current = host.value;
  if (!current || current.flag_new_domains === value) return;
  flagSaving.value = true;
  flagError.value = null;
  // Optimistic update; revert if the save fails.
  host.value = { ...current, flag_new_domains: value };
  try {
    host.value = await updateHost(current.id, { flag_new_domains: value });
  } catch (e) {
    flagError.value = apiErrorMessage(e);
    host.value = current;
  } finally {
    flagSaving.value = false;
  }
}

onMounted(() => {
  if (!store.loaded) void store.load();
  void loadHistory();
  void loadHost();
});

// Re-fetch when navigating between clients without leaving the route.
watch(client, () => {
  void loadHistory();
  void loadHost();
});
</script>

<template>
  <div class="client-details">
    <!-- Header -->
    <v-card
      color="surface-card"
      class="mb-4"
    >
      <v-card-text class="d-flex align-center flex-wrap ga-4">
        <v-icon
          icon="mdi-monitor"
          size="48"
          color="primary"
        />
        <div>
          <div class="text-h5 font-weight-bold">
            {{ client }}
          </div>
          <div class="text-medium-emphasis text-body-2">
            {{ summary ? summary.total_queries.toLocaleString() : "—" }} queries ·
            {{ summary ? summary.domain_count.toLocaleString() : "—" }} domains
            <template v-if="summary?.last_seen">
              · last seen {{ summary.last_seen }}
            </template>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Per-client controls -->
    <div class="d-flex flex-wrap ga-4 mb-4">
      <v-card
        color="surface-card"
        class="setting-box"
      >
        <v-card-title class="text-subtitle-1">
          New domain monitoring
        </v-card-title>
        <v-divider />
        <v-card-text>
          <div class="text-body-2 text-medium-emphasis mb-3">
            Whether newly seen domains for this client are flagged for monitoring.
          </div>
          <v-btn-toggle
            :model-value="newDomainMonitoring"
            mandatory
            divided
            color="primary"
            :disabled="hostLoading || flagSaving || !host"
            @update:model-value="setNewDomainMonitoring"
          >
            <v-btn :value="true">
              Include
            </v-btn>
            <v-btn :value="false">
              Exclude
            </v-btn>
          </v-btn-toggle>
          <div
            v-if="flagSaving"
            class="text-caption text-medium-emphasis mt-2"
          >
            Saving…
          </div>
          <v-alert
            v-if="flagError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            {{ flagError }}
          </v-alert>
          <v-alert
            v-else-if="hostError"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            {{ hostError }}
          </v-alert>
        </v-card-text>
      </v-card>
    </div>

    <!-- Last 100 hours of DNS queries -->
    <div class="mb-4">
      <ClientQueriesChart
        :history="history"
        :loading="historyLoading"
        :error="historyError"
      />
    </div>

    <!-- Per-client domain breakdown -->
    <v-card color="surface-card">
      <v-card-title class="text-subtitle-1">
        Domains queried
      </v-card-title>
      <v-divider />
      <v-data-table
        :headers="headers"
        :items="domainRows"
        density="comfortable"
        class="app-table"
        mobile-breakpoint="md"
        :items-per-page="25"
      >
        <template #item.last_action="{ item }">
          {{ item.last_action ?? "—" }}
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<style scoped>
.client-details {
  animation: fadeIn 0.3s ease-in-out;
}

.setting-box {
  flex: 0 1 340px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
