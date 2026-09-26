<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useClientsStore } from "@/stores/clients";
import { getClientStats } from "@/services/stats";
import { apiErrorMessage } from "@/services/errors";
import SiteTrafficChart from "@/components/dashboard/SiteTrafficChart.vue";
import ClientModeControl from "@/components/client-details/ClientModeControl.vue";
import HostNameEditor from "@/components/client-details/HostNameEditor.vue";
import type { ClientStat, QueryLog } from "@/types/domain";

const route = useRoute();
const store = useClientsStore();

const client = computed(() => route.params.client as string);

const stats = ref<ClientStat[]>([]);
const statsLoading = ref(true);
const statsError = ref<string | null>(null);

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

async function loadStats(): Promise<void> {
  statsLoading.value = true;
  statsError.value = null;
  try {
    stats.value = await getClientStats(client.value, 100);
  } catch (e) {
    statsError.value = apiErrorMessage(e);
    stats.value = [];
  } finally {
    statsLoading.value = false;
  }
}

onMounted(() => {
  if (!store.loaded) void store.load();
  void loadStats();
});

// Re-fetch when navigating between clients without leaving the route.
watch(client, () => {
  void loadStats();
});
</script>

<template>
  <div class="client-details">
    <!-- Header -->
    <v-card
      color="surface-card"
      class="mb-4"
    >
      <v-card-text>
        <div class="d-flex flex-column flex-sm-row align-start align-sm-center">
          <!-- Device icon -->
          <div class="device-icon-container me-sm-4 mb-3 mb-sm-0">
            <v-icon
              icon="mdi-monitor"
              size="96"
              color="primary"
              class="icon-with-background"
            />
          </div>

          <!-- Client info -->
          <div class="client-title">
            <HostNameEditor :client="client" />
            <div class="text-subtitle-1 text-green">
              IP Address: {{ client }}
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Response policy (mode) for this client -->
    <div class="mb-4">
      <ClientModeControl :client="client" />
    </div>

    <!-- Last 100 hours of DNS queries (same layout as the dashboard chart) -->
    <div class="mb-4">
      <SiteTrafficChart
        title="DNS Traffic"
        :stats="stats"
        :loading="statsLoading"
        :error="statsError"
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

.text-subtitle-1 {
  color: rgb(92, 221, 139) !important;
  font-size: 16px !important;
  font-weight: 700 !important;
  margin-top: 3px;
  word-break: break-word;
}

.device-icon-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 120px;
  position: relative;
}

.client-title {
  flex: 1;
}

.icon-with-background {
  opacity: 0.9;
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
