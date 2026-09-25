<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useClientsStore } from "@/stores/clients";
import { getClientHistory } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import ClientQueriesChart from "@/components/client-details/ClientQueriesChart.vue";
import type { ClientHourlyStat, QueryLog } from "@/types/domain";

const route = useRoute();
const store = useClientsStore();

const client = computed(() => route.params.client as string);

const history = ref<ClientHourlyStat[]>([]);
const historyLoading = ref(true);
const historyError = ref<string | null>(null);

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

onMounted(() => {
  if (!store.loaded) void store.load();
  void loadHistory();
});

// Re-fetch when navigating between clients without leaving the route.
watch(client, () => {
  void loadHistory();
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

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
