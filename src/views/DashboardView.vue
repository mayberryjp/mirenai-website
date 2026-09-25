<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useClientsStore } from "@/stores/clients";
import { usePoliciesStore } from "@/stores/policies";
import { useUpstreamsStore } from "@/stores/upstreams";
import { useBlocklistsStore } from "@/stores/blocklists";
import { getHealth, getReady } from "@/services/health";
import { apiErrorMessage } from "@/services/errors";

const clients = useClientsStore();
const policies = usePoliciesStore();
const upstreams = useUpstreamsStore();
const blocklists = useBlocklistsStore();

const ready = ref<boolean | null>(null);
const service = ref<string | null>(null);
const healthError = ref<string | null>(null);

const stats = computed(() => [
  { label: "Clients", description: "Seen", value: clients.total, color: "text-blue" },
  { label: "Queries", description: "Logged", value: clients.totalQueries, color: "text-green" },
  { label: "Policies", description: "Total", value: policies.total, color: "text-blue" },
  { label: "Upstreams", description: "Total", value: upstreams.total, color: "text-blue" },
  { label: "Blocklists", description: "Total", value: blocklists.total, color: "text-green" }
]);

function fmt(n: number): string {
  return n.toLocaleString();
}

async function loadHealth(): Promise<void> {
  healthError.value = null;
  try {
    const [h, r] = await Promise.all([getHealth(), getReady()]);
    service.value = h.service;
    ready.value = r.ready;
  } catch (e) {
    healthError.value = apiErrorMessage(e);
  }
}

onMounted(() => {
  if (!clients.loaded) void clients.load();
  void policies.load();
  void upstreams.load();
  void blocklists.load();
  void loadHealth();
});
</script>

<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-4">
      Dashboard
    </h1>

    <!-- Quick stats banner -->
    <v-row class="quickstats-background ma-0 rounded-lg mb-4">
      <v-col
        v-for="(s, i) in stats"
        :key="i"
        cols="6"
        sm="4"
        md
        class="bg-transparent"
      >
        <v-card
          variant="plain"
          class="text-center pa-2 pa-sm-4 bg-transparent"
        >
          <div class="stat-label mb-1">
            {{ s.label }}
          </div>
          <div class="stat-description mb-1">
            {{ s.description }}
          </div>
          <div :class="['stat-value font-weight-bold', s.color]">
            {{ fmt(s.value) }}
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Select-a-client hint -->
    <v-card
      color="surface-card"
      class="mb-4"
    >
      <v-card-text class="d-flex align-center ga-3">
        <v-icon
          icon="mdi-arrow-left-bold-outline"
          color="primary"
        />
        <div>
          <div class="text-subtitle-1 font-weight-medium">
            Select a client
          </div>
          <div class="text-medium-emphasis text-body-2">
            Choose a client from the list to view its DNS queries over the last 100 hours.
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Server status -->
    <v-card color="surface-card">
      <v-card-title class="text-subtitle-1">
        Server status
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-alert
          v-if="healthError"
          type="error"
          variant="tonal"
        >
          {{ healthError }}
        </v-alert>
        <template v-else>
          <div class="d-flex align-center mb-2">
            <v-icon
              :icon="ready ? 'mdi-check-circle' : 'mdi-alert-circle'"
              :color="ready ? 'success' : 'warning'"
              class="mr-2"
            />
            <span>{{ ready === null ? "Checking…" : ready ? "Database reachable" : "Not ready" }}</span>
          </div>
          <div class="text-medium-emphasis">
            Service: {{ service ?? "—" }}
          </div>
        </template>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.quickstats-background {
  background-color: #0d1117 !important;
  color: rgba(255, 255, 255, 0.87);
  padding: 5px;
}

.stat-label {
  color: #b1b8c0;
  font-size: 1.25rem;
  font-weight: 500;
  font-family: var(--app-font-family);
}

.stat-description {
  font-size: 14px;
  color: #8b949e;
}

.stat-value {
  font-size: 2rem;
  line-height: 2.4rem;
}

.text-blue {
  color: #3b82f6 !important;
}

.text-green {
  color: #5cdd8b !important;
}
</style>
